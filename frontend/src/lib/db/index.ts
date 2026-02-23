import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Timer, TimeLog, User, SyncQueueItem, Balance, Holiday, BalanceCalcMeta } from '../../types';
import type { TargetWithSpecs } from '../../types';
import { dayjs, userTimezone } from '../../../../lib/utils/dayjs.js';
import { calculateTimelogDuration } from '../../../../lib/utils/balance';

interface TapShiftDB extends DBSchema {
  timers: {
    key: string;
    value: Timer;
  };
  timelogs: {
    key: string;
    value: TimeLog;
    indexes: { 
      'by-timer': string;
      'by-year-month': [number, number];
    };
  };
  targets: {
    key: string;
    value: TargetWithSpecs;
  };
  balances: {
    key: string;
    value: Balance;
    indexes: {
      'by-date': string;
      'by-target-id': string;
    };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
  };
  user: {
    key: string;
    value: User;
  };
  settings: {
    key: string;
    value: any;
  };
  states: {
    key: string;
    value: any;
  };
  holidays: {
    key: string;
    value: Holiday & { cacheKey: string }; // cacheKey = country-year
    indexes: {
      'by-country-year': string;
      'by-date': string;
    };
  };
}

const DB_NAME = 'tapshift';
const DB_VERSION = 2; // Incremented to add holidays store

let dbInstance: IDBPDatabase<TapShiftDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<TapShiftDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<TapShiftDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Timers store (formerly buttons)
      if (!db.objectStoreNames.contains('timers')) {
        db.createObjectStore('timers', { keyPath: 'id' });
      }

      // TimeLogs store
      if (!db.objectStoreNames.contains('timelogs')) {
        const timelogStore = db.createObjectStore('timelogs', { keyPath: 'id' });
        timelogStore.createIndex('by-timer', 'timer_id');
        timelogStore.createIndex('by-year-month', ['year', 'month']);
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }

      // User store
      if (!db.objectStoreNames.contains('user')) {
        db.createObjectStore('user', { keyPath: 'id' });
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }

      // Targets store
      if (!db.objectStoreNames.contains('targets')) {
        db.createObjectStore('targets', { keyPath: 'id' });
      }

      // States store
      if (!db.objectStoreNames.contains('states')) {
        db.createObjectStore('states', { keyPath: 'code' });
      }

      // Balances store (unified for daily/monthly/yearly)
      // ID is composite: {target_id}_{date}
      if (!db.objectStoreNames.contains('balances')) {
        const balanceStore = db.createObjectStore('balances', { keyPath: 'id' });
        balanceStore.createIndex('by-date', 'date');
        balanceStore.createIndex('by-target-id', 'target_id');
      }

      // Holidays store
      if (!db.objectStoreNames.contains('holidays')) {
        const holidayStore = db.createObjectStore('holidays', { keyPath: 'id' });
        holidayStore.createIndex('by-country-year', 'cacheKey');
        holidayStore.createIndex('by-date', 'date');
      }
    },
  });

  return dbInstance;
}

// Timer operations (formerly Button)
export async function saveTimer(timer: Timer): Promise<void> {
  const db = await getDB();
  await db.put('timers', timer);
}

export async function getTimer(id: string): Promise<Timer | undefined> {
  const db = await getDB();
  return db.get('timers', id);
}

export async function getAllTimers(): Promise<Timer[]> {
  const db = await getDB();
  return db.getAll('timers');
}

export async function deleteTimer(timer: Timer): Promise<void> {
  const db = await getDB();
  await db.delete('timers', timer.id);
}

// TimeLog operations
export async function saveTimeLog(timelog: TimeLog): Promise<void> {
  const db = await getDB();
  
  // For special types (non-normal), preserve duration from backend
  // For normal type, calculate duration if it's 0 or undefined and we have both timestamps
  let finalTimelog = timelog;
  const type = timelog.type || 'normal';
  // set month and year for indexing
  finalTimelog = {
    ...timelog,
    month: dayjs(timelog.start_timestamp).tz(userTimezone).month() + 1,
    year: dayjs(timelog.start_timestamp).tz(userTimezone).year(),
  };

  // Determine whether to apply break calculation
  // Priority: timelog's explicit setting > timer's auto_subtract_breaks > false
  let applyBreaks = timelog.apply_break_calculation;
  
  // Only check timer setting if apply_break_calculation is not explicitly set
  if (applyBreaks === undefined && timelog.timer_id) {
    try {
      const timer = await getTimer(timelog.timer_id);
      if (timer) {
        applyBreaks = timer.auto_subtract_breaks;
      }
    } catch (err) {
      console.warn('Failed to read timer for break calculation:', err);
    }
  }
  
  // Default to false if still undefined
  applyBreaks = applyBreaks ?? false;
    

  finalTimelog = {
    ...finalTimelog,
    duration_minutes: calculateTimelogDuration(finalTimelog),
    apply_break_calculation: applyBreaks,
  };

  await db.put('timelogs', finalTimelog);
}

export async function getTimeLog(id: string): Promise<TimeLog | undefined> {
  const db = await getDB();
  return db.get('timelogs', id);
}

export async function getTimeLogsByTimer(timerId: string): Promise<TimeLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('timelogs', 'by-timer', timerId);
}

export async function getTimeLogsByYearMonth(year: number, month: number): Promise<TimeLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('timelogs', 'by-year-month', [year, month]);
}

export async function getAllTimeLogs(): Promise<TimeLog[]> {
  const db = await getDB();
  return db.getAll('timelogs');
}

export async function deleteTimeLog(timelog: TimeLog): Promise<void> {
  if (!timelog || !timelog.id) {
    console.error('Cannot delete timelog: invalid or missing id', timelog);
    throw new Error('Cannot delete timelog: invalid or missing id');
  }
  const db = await getDB();
  await db.delete('timelogs', timelog.id);
}

// Sync queue operations
export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', item);
}

export async function getUnsyncedItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  const allItems = await db.getAll('syncQueue');
  return allItems.filter(item => !item.synced);
}

export async function markItemSynced(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('syncQueue', id);
  if (item) {
    item.synced = true;
    await db.put('syncQueue', item);
  }
}

export async function deleteFromSyncQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

// User operations
export async function saveUser(user: User): Promise<void> {
  const db = await getDB();
  await db.put('user', user);
}

export async function getUser(): Promise<User | undefined> {
  const db = await getDB();
  const users = await db.getAll('user');
  return users[0];
}

export async function clearUser(): Promise<void> {
  const db = await getDB();
  await db.clear('user');
}

// Settings operations
export async function saveSetting(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('settings', value, key);
}

export async function getSetting(key: string): Promise<any> {
  const db = await getDB();
  return db.get('settings', key);
}

// Balance Calc Metadata operations
const BALANCE_CALC_META_KEY = 'balance_calc_meta_v1';

/**
 * Get the balance calculation metadata
 * @returns The metadata or null if not found
 */
export async function getBalanceCalcMeta(): Promise<BalanceCalcMeta | null> {
  const meta = await getSetting(BALANCE_CALC_META_KEY);
  return meta ?? null;
}

/**
 * Set the last updated day for a specific target
 * @param targetId - Target ID to update
 * @param lastUpdatedDay - Last day (YYYY-MM-DD) for which balances are derived
 * @param userId - User ID for metadata
 */
export async function setBalanceCalcMetaForTarget(
  targetId: string,
  lastUpdatedDay: string,
  userId: string
): Promise<void> {
  const meta = await getBalanceCalcMeta() ?? {
    schema_version: 1 as const,
    user_id: userId,
    targets: {}
  };

  meta.targets[targetId] = {
    last_updated_day: lastUpdatedDay,
    updated_at: new Date().toISOString()
  };

  await saveSetting(BALANCE_CALC_META_KEY, meta);
}

/**
 * Clear balance calculation metadata
 * @param targetId - Optional target ID to clear. If omitted, clears all metadata.
 */
export async function clearBalanceCalcMeta(targetId?: string): Promise<void> {
  if (!targetId) {
    const db = await getDB();
    await db.delete('settings', BALANCE_CALC_META_KEY);
    return;
  }

  const meta = await getBalanceCalcMeta();
  if (meta?.targets[targetId]) {
    delete meta.targets[targetId];
    await saveSetting(BALANCE_CALC_META_KEY, meta);
  }
}

// Sync cursor operations
export async function saveSyncCursor(type: 'timers' | 'timelogs' | 'targets' | 'balances', cursor: string): Promise<void> {
  await saveSetting(`sync_cursor_${type}`, cursor);
}

export async function getSyncCursor(type: 'timers' | 'timelogs' | 'targets' | 'balances'): Promise<string | undefined> {
  return await getSetting(`sync_cursor_${type}`);
}

// Target operations (now with nested target_specs)
export async function saveTarget(target: TargetWithSpecs): Promise<void> {
  const db = await getDB();
  await db.put('targets', target);
}

export async function getTarget(id: string): Promise<TargetWithSpecs | undefined> {
  const db = await getDB();
  return db.get('targets', id);
}

export async function getAllTargets(): Promise<TargetWithSpecs[]> {
  const db = await getDB();
  return db.getAll('targets');
}

export async function getTargetStates(): Promise<string[]> {
  const targets = await getAllTargets();
  const states: string[] = [];
  for (const target of targets) {
    for (const spec of target.target_specs || []) {
      if (spec.state_code) {
        states.push(spec.state_code);
      }
    }
  }
  return states;
}

export async function deleteTarget(target: TargetWithSpecs): Promise<void> {
  const db = await getDB();
  await db.delete('targets', target.id);
}

export async function getAllStates(): Promise<any[]> {
  const db = await getDB();
  return db.getAll('states');
}

export async function saveStates(states: any[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('states', 'readwrite');
  states.forEach(state => tx.store.put(state));
  await tx.done;
}

// Clear all data
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear('timers');
  await db.clear('timelogs');
  await db.clear('targets');
  await db.clear('balances');
  await db.clear('syncQueue');
  await db.clear('user');
  await db.clear('settings');
}

// Balance operations (unified for daily/monthly/yearly)
export async function saveBalance(balance: Balance): Promise<void> {
  const db = await getDB();
  await db.put('balances', balance);
}

export async function getBalance(id: string): Promise<Balance | undefined> {
  const db = await getDB();
  return db.get('balances', id);
}

export async function getAllBalances(): Promise<Balance[]> {
  const db = await getDB();
  return db.getAll('balances');
}

export async function getBalancesCount(): Promise<number> {
  const db = await getDB();
  return db.count('balances');
}

export async function getBalancesByDate(date: string): Promise<Balance[]> {
  const db = await getDB();
  return db.getAllFromIndex('balances', 'by-date', date);
}

export async function getBalancesByTargetId(targetId: string): Promise<Balance[]> {
  const db = await getDB();
  return db.getAllFromIndex('balances', 'by-target-id', targetId);
}

export async function deleteBalance(balance: Balance): Promise<void> {
  const db = await getDB();
  await db.delete('balances', balance.id);
}
