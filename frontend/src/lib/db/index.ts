import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Timer, TimeLog, User, SyncQueueItem, Balance, Holiday, BalanceCalcMeta } from '../../types';
import type { TargetWithSpecs } from '../../types';
import { dayjs, userTimezone } from '../../../../lib/utils/dayjs.js';
import { calculateTimelogDuration } from '../../../../lib/utils/balance';

interface LogFizzDB extends DBSchema {
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
  /** Maps each calendar day (YYYY-MM-DD) to the IDs of timelogs that span it */
  timelogDateIndex: {
    key: string; // YYYY-MM-DD
    value: { date: string; timelogIds: string[] };
  };
}

const DB_NAME = 'logfizz';
const DB_VERSION = 4; // Incremented to add timelogDateIndex store

let dbInstance: IDBPDatabase<LogFizzDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<LogFizzDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<LogFizzDB>(DB_NAME, DB_VERSION, {
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

      // Timelog date index: maps YYYY-MM-DD → list of timelog IDs spanning that day.
      // Created at DB_VERSION 4. When upgrading from an older version the index will be
      // empty and will be populated lazily via rebuildTimelogDateIndex().
      if (!db.objectStoreNames.contains('timelogDateIndex')) {
        db.createObjectStore('timelogDateIndex', { keyPath: 'date' });
      }
    },
  });

  return dbInstance;
}

// ── Timelog Date Index helpers ────────────────────────────────────────────────

const TIMELOG_DATE_INDEX_BUILT_KEY = 'timelog_date_index_v1';

/**
 * Enumerate all calendar days (YYYY-MM-DD, UTC) that a timelog spans.
 * Running timelogs (no end_timestamp) are treated as ending today.
 */
function getDateRangeForTimelog(timelog: TimeLog): string[] {
  const timezone = timelog.timezone || userTimezone || 'UTC';
  const start = dayjs.utc(timelog.start_timestamp).tz(timezone).startOf('day');
  const end = (timelog.end_timestamp ? dayjs.utc(timelog.end_timestamp).tz(timezone) : dayjs.utc()).endOf('day');
  const dates: string[] = [];
  for (let d = start; !d.isAfter(end); d = d.add(1, 'day')) {
    dates.push(d.format('YYYY-MM-DD'));
  }
  return dates;
}

/** Add a timelog ID to all given date entries in the index (internal, uses open db). */
async function _addToDateIndex(db: IDBPDatabase<LogFizzDB>, timelogId: string, dates: string[]): Promise<void> {
  for (const date of dates) {
    const entry = await db.get('timelogDateIndex', date) ?? { date, timelogIds: [] };
    if (!entry.timelogIds.includes(timelogId)) {
      entry.timelogIds.push(timelogId);
      await db.put('timelogDateIndex', entry);
    }
  }
}

/** Remove a timelog ID from all given date entries in the index (internal, uses open db). */
async function _removeFromDateIndex(db: IDBPDatabase<LogFizzDB>, timelogId: string, dates: string[]): Promise<void> {
  for (const date of dates) {
    const entry = await db.get('timelogDateIndex', date);
    if (!entry) continue;
    entry.timelogIds = entry.timelogIds.filter(id => id !== timelogId);
    if (entry.timelogIds.length === 0) {
      await db.delete('timelogDateIndex', date);
    } else {
      await db.put('timelogDateIndex', entry);
    }
  }
}

/**
 * Get the timelog IDs that span a given date.
 * Returns an empty array if the date has no entry in the index.
 */
export async function getTimelogIdsForDate(date: string): Promise<string[]> {
  const db = await getDB();
  const entry = await db.get('timelogDateIndex', date);
  return entry?.timelogIds ?? [];
}

/**
 * Fetch multiple timelogs by their IDs (skips missing ones).
 */
export async function getTimeLogsByIds(ids: string[]): Promise<TimeLog[]> {
  if (ids.length === 0) return [];
  const db = await getDB();
  const results: TimeLog[] = [];
  for (const id of ids) {
    const tl = await db.get('timelogs', id);
    if (tl) results.push(tl);
  }
  return results;
}

/**
 * Wipe the entire timelog date index (and its "built" flag).
 * Call this before a full balance recalculation.
 */
export async function clearTimelogDateIndex(): Promise<void> {
  const db = await getDB();
  await db.clear('timelogDateIndex');
  await db.delete('settings', TIMELOG_DATE_INDEX_BUILT_KEY);
}

/**
 * Rebuild the timelog date index from scratch using all stored timelogs.
 * Clears the existing index first.
 */
export async function rebuildTimelogDateIndex(): Promise<void> {
  const db = await getDB();
  await db.clear('timelogDateIndex');
  const allTimelogs = await db.getAll('timelogs');
  for (const tl of allTimelogs) {
    if (tl.deleted_at) continue;
    await _addToDateIndex(db, tl.id, getDateRangeForTimelog(tl));
  }
  await db.put('settings', true, TIMELOG_DATE_INDEX_BUILT_KEY);
}

/**
 * Fetch all timelogs that span ANY day in the given date range (inclusive).
 * Uses the timelogDateIndex IDB store with a key-range query for efficiency.
 * Skips soft-deleted timelogs.
 *
 * @param startDate - ISO date string 'YYYY-MM-DD' (inclusive)
 * @param endDate   - ISO date string 'YYYY-MM-DD' (inclusive)
 */
export async function getTimeLogsByDateRange(startDate: string, endDate: string): Promise<TimeLog[]> {
  const db = await getDB();
  const range = IDBKeyRange.bound(startDate, endDate);
  const entries = await db.getAll('timelogDateIndex', range);

  // Collect unique IDs across all date entries
  const idSet = new Set<string>();
  for (const entry of entries) {
    for (const id of entry.timelogIds) {
      idSet.add(id);
    }
  }

  // Fetch the actual timelog records, skip missing or soft-deleted ones
  const results: TimeLog[] = [];
  for (const id of idSet) {
    const tl = await db.get('timelogs', id);
    if (tl && !tl.deleted_at) results.push(tl);
  }
  return results;
}

/**
 * Ensure the timelog date index has been built at least once.
 * Rebuilds automatically when the "built" flag is missing (e.g. first run after
 * a DB upgrade from version < 4 or after clearTimelogDateIndex()).
 */
export async function ensureTimelogDateIndex(): Promise<void> {
  const db = await getDB();
  const built = await db.get('settings', TIMELOG_DATE_INDEX_BUILT_KEY);
  if (!built) {
    await rebuildTimelogDateIndex();
  }
}

// ── Timer operations (formerly Button) ────────────────────────────────────────

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
    month: dayjs.utc(timelog.start_timestamp).tz(userTimezone).month() + 1,
    year: dayjs.utc(timelog.start_timestamp).tz(userTimezone).year(),
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

  // ── Update the timelog date index ──────────────────────────────────────────
  // Only touch the index when it has already been built to avoid accidentally
  // triggering a rebuild here (the rebuild happens lazily in ensureTimelogDateIndex).
  const indexBuilt = await db.get('settings', TIMELOG_DATE_INDEX_BUILT_KEY);
  if (indexBuilt) {
    // Remove from old dates if the timelog already existed
    const oldTimelog = await db.get('timelogs', finalTimelog.id);
    if (oldTimelog && !oldTimelog.deleted_at) {
      await _removeFromDateIndex(db, oldTimelog.id, getDateRangeForTimelog(oldTimelog));
    }
    // Add to new dates (unless this is a soft-delete)
    if (!finalTimelog.deleted_at) {
      await _addToDateIndex(db, finalTimelog.id, getDateRangeForTimelog(finalTimelog));
    }
  }

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

  // Remove from date index if the index has been built
  const indexBuilt = await db.get('settings', TIMELOG_DATE_INDEX_BUILT_KEY);
  if (indexBuilt) {
    const existing = await db.get('timelogs', timelog.id);
    if (existing && !existing.deleted_at) {
      await _removeFromDateIndex(db, existing.id, getDateRangeForTimelog(existing));
    }
  }

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
  await db.put('balances', {
    ...balance,
    normal_days: balance.normal_days ?? 0,
  });
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
