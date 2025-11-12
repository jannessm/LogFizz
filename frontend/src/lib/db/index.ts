import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Button, TimeLog, User, SyncQueueItem } from '../../types';

interface ClockDB extends DBSchema {
  buttons: {
    key: string;
    value: Button;
    indexes: { 'by-position': number };
  };
  timelogs: {
    key: string;
    value: TimeLog;
    indexes: { 
      'by-button': string;
      'by-start': string;
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
}

const DB_NAME = 'clock-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<ClockDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<ClockDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<ClockDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Buttons store
      if (!db.objectStoreNames.contains('buttons')) {
        const buttonStore = db.createObjectStore('buttons', { keyPath: 'id' });
        buttonStore.createIndex('by-position', 'position');
      }

      // TimeLogs store
      if (!db.objectStoreNames.contains('timelogs')) {
        const timelogStore = db.createObjectStore('timelogs', { keyPath: 'id' });
        timelogStore.createIndex('by-button', 'button_id');
        timelogStore.createIndex('by-start', 'start_time');
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
  return db.getAllFromIndex('buttons', 'by-position');
}

export async function deleteButton(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('buttons', id);
}

// TimeLog operations
export async function saveTimeLog(timelog: TimeLog): Promise<void> {
  const db = await getDB();
  await db.put('timelogs', timelog);
}

export async function getTimeLog(id: string): Promise<TimeLog | undefined> {
  const db = await getDB();
  return db.get('timelogs', id);
}

export async function getAllTimeLogs(): Promise<TimeLog[]> {
  const db = await getDB();
  return db.getAll('timelogs');
}

export async function getTimeLogsByButton(buttonId: string): Promise<TimeLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('timelogs', 'by-button', buttonId);
}

export async function deleteTimeLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('timelogs', id);
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
export async function saveSyncCursor(type: 'buttons' | 'timelogs', cursor: string): Promise<void> {
  await saveSetting(`sync_cursor_${type}`, cursor);
}

export async function getSyncCursor(type: 'buttons' | 'timelogs'): Promise<string | undefined> {
  return await getSetting(`sync_cursor_${type}`);
}

// Clear all data
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear('buttons');
  await db.clear('timelogs');
  await db.clear('syncQueue');
  await db.clear('user');
  await db.clear('settings');
}
