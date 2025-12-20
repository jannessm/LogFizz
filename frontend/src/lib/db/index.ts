import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Button, TimeLog, User, SyncQueueItem, DailyTarget, MonthlyBalance } from '../../types';
import { dayjs, userTimezone } from '../../../../lib/utils/dayjs.js';

interface ClockDB extends DBSchema {
  buttons: {
    key: string;
    value: Button;
  };
  timelogs: {
    key: string;
    value: TimeLog;
    indexes: { 
      'by-button': string;
      'by-year-month': [number, number];
    };
  };
  targets: {
    key: string;
    value: DailyTarget;
  };
  monthlyBalances: {
    key: string;
    value: MonthlyBalance;
    indexes: {
      'by-year-month': [number, number];
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
  }
}

const DB_NAME = 'tapshift-db';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase<ClockDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<ClockDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<ClockDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Buttons store
      if (!db.objectStoreNames.contains('buttons')) {
        const buttonStore = db.createObjectStore('buttons', { keyPath: 'id' });
      }

      // TimeLogs store
      if (!db.objectStoreNames.contains('timelogs')) {
        const timelogStore = db.createObjectStore('timelogs', { keyPath: 'id' });
        timelogStore.createIndex('by-button', 'button_id');
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
        db.createObjectStore('states', { keyPath: 'id' });
      }

      // Monthly Balances store (added in version 2)
      if (!db.objectStoreNames.contains('monthlyBalances')) {
        const monthlyBalanceStore = db.createObjectStore('monthlyBalances', { keyPath: 'id' });
        monthlyBalanceStore.createIndex('by-year-month', ['year', 'month']);
        monthlyBalanceStore.createIndex('by-target-id', 'target_id');
      }
    },
  });

  return dbInstance;
}

// Button operations
export async function saveButton(button: Button): Promise<void> {
  const db = await getDB();
  await db.put('buttons', button);
}

export async function getButton(id: string): Promise<Button | undefined> {
  const db = await getDB();
  return db.get('buttons', id);
}

export async function getAllButtons(): Promise<Button[]> {
  const db = await getDB();
  return db.getAll('buttons');
}

export async function deleteButton(button: Button): Promise<void> {
  const db = await getDB();
  await db.delete('buttons', button.id);
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

  if (type === 'normal' && timelog.start_timestamp && timelog.end_timestamp) {
    
    // Determine whether to apply break calculation
    // Priority: timelog's explicit setting > button's auto_subtract_breaks > false
    let applyBreaks = timelog.apply_break_calculation;
    
    // Only check button setting if apply_break_calculation is not explicitly set
    if (applyBreaks === undefined && timelog.button_id) {
      try {
        const button = await getButton(timelog.button_id);
        if (button) {
          applyBreaks = button.auto_subtract_breaks;
        }
      } catch (err) {
        console.warn('Failed to read button for break calculation:', err);
      }
    }
    
    // Default to false if still undefined
    applyBreaks = applyBreaks ?? false;
    
    // Calculate duration in minutes
    const start = new Date(timelog.start_timestamp).getTime();
    const end = new Date(timelog.end_timestamp).getTime();
    let minutes = Math.round((end - start) / (1000 * 60));
    
    // Apply German break rules if enabled
    if (applyBreaks) {
      if (minutes >= 9 * 60) {
        minutes -= 45; // 45 minutes break for 9+ hours
      } else if (minutes >= 6 * 60) {
        minutes -= 30; // 30 minutes break for 6-9 hours
      }
    }
    
    finalTimelog = {
      ...timelog,
      duration_minutes: Math.max(0, minutes),
      apply_break_calculation: applyBreaks,
    };
  }
  // For special types, keep the duration as-is (calculated by backend from daily target)

  await db.put('timelogs', finalTimelog);
}

export async function getTimeLog(id: string): Promise<TimeLog | undefined> {
  const db = await getDB();
  return db.get('timelogs', id);
}

export async function getTimeLogsByButton(buttonId: string): Promise<TimeLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('timelogs', 'by-button', buttonId);
}

export async function getTimeLogsByYearMonth(year: number, month: number): Promise<TimeLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('timelogs', 'by-year-month', [year, month]);
}

export async function deleteTimeLog(timelog: TimeLog): Promise<void> {
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

// Sync cursor operations
export async function saveSyncCursor(type: 'buttons' | 'timelogs' | 'targets' | 'monthlyBalances', cursor: string): Promise<void> {
  await saveSetting(`sync_cursor_${type}`, cursor);
}

export async function getSyncCursor(type: 'buttons' | 'timelogs' | 'targets' | 'monthlyBalances'): Promise<string | undefined> {
  return await getSetting(`sync_cursor_${type}`);
}

// Target operations
export async function saveTarget(target: DailyTarget): Promise<void> {
  const db = await getDB();
  await db.put('targets', target);
}

export async function getTarget(id: string): Promise<DailyTarget | undefined> {
  const db = await getDB();
  return db.get('targets', id);
}

export async function getAllTargets(): Promise<DailyTarget[]> {
  const db = await getDB();
  return db.getAll('targets');
}

export async function getTargetStates(): Promise<string[]> {
  const targets = await getAllTargets();
  const states = targets.map(target => target.state_code).filter(code => code !== undefined) as string[];
  return states;
}

export async function deleteTarget(target: DailyTarget): Promise<void> {
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
  await db.clear('buttons');
  await db.clear('timelogs');
  await db.clear('targets');
  await db.clear('monthlyBalances');
  await db.clear('syncQueue');
  await db.clear('user');
  await db.clear('settings');
}

// Monthly Balance operations
export async function saveMonthlyBalance(balance: MonthlyBalance): Promise<void> {
  const db = await getDB();
  await db.put('monthlyBalances', balance);
}

export async function getMonthlyBalance(id: string): Promise<MonthlyBalance | undefined> {
  const db = await getDB();
  return db.get('monthlyBalances', id);
}

export async function getAllMonthlyBalances(): Promise<MonthlyBalance[]> {
  const db = await getDB();
  return db.getAll('monthlyBalances');
}

export async function getMonthlyBalancesByYearMonth(year: number, month: number): Promise<MonthlyBalance[]> {
  const db = await getDB();
  return db.getAllFromIndex('monthlyBalances', 'by-year-month', [year, month]);
}

export async function getMonthlyBalancesByTargetId(targetId: string): Promise<MonthlyBalance[]> {
  const db = await getDB();
  return db.getAllFromIndex('monthlyBalances', 'by-target-id', targetId);
}

export async function deleteMonthlyBalance(balance: MonthlyBalance): Promise<void> {
  const db = await getDB();
  await db.delete('monthlyBalances', balance.id);
}
