import { 
  addToSyncQueue, 
  getUnsyncedItems, 
  markItemSynced,
  deleteFromSyncQueue,
  saveButton,
  saveTimeLog,
  deleteButton,
  deleteTimeLog,
} from '../lib/db';
import { buttonApi, timeLogApi, isOnline } from './api';
import type { Button, TimeLog, SyncQueueItem } from '../types';

export class SyncService {
  private isSyncing = false;
  private syncListeners: (() => void)[] = [];

  // Queue operations for sync
  async queueButtonCreate(button: Button): Promise<void> {
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      type: 'button',
      operation: 'create',
      data: button,
      timestamp: Date.now(),
      synced: false,
    };
    await addToSyncQueue(item);
    await saveButton(button); // Save locally immediately
    this.notifyListeners();
  }

  async queueButtonUpdate(button: Button): Promise<void> {
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      type: 'button',
      operation: 'update',
      data: button,
      timestamp: Date.now(),
      synced: false,
    };
    await addToSyncQueue(item);
    await saveButton(button); // Update locally immediately
    this.notifyListeners();
  }

  async queueButtonDelete(buttonId: string): Promise<void> {
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      type: 'button',
      operation: 'delete',
      data: { id: buttonId },
      timestamp: Date.now(),
      synced: false,
    };
    await addToSyncQueue(item);
    await deleteButton(buttonId); // Delete locally immediately
    this.notifyListeners();
  }

  async queueTimeLogCreate(timeLog: TimeLog): Promise<void> {
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      type: 'timelog',
      operation: 'create',
      data: timeLog,
      timestamp: Date.now(),
      synced: false,
    };
    await addToSyncQueue(item);
    await saveTimeLog(timeLog); // Save locally immediately
    this.notifyListeners();
  }

  async queueTimeLogUpdate(timeLog: TimeLog): Promise<void> {
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      type: 'timelog',
      operation: 'update',
      data: timeLog,
      timestamp: Date.now(),
      synced: false,
    };
    await addToSyncQueue(item);
    await saveTimeLog(timeLog); // Update locally immediately
    this.notifyListeners();
  }

  async queueTimeLogDelete(timeLogId: string): Promise<void> {
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      type: 'timelog',
      operation: 'delete',
      data: { id: timeLogId },
      timestamp: Date.now(),
      synced: false,
    };
    await addToSyncQueue(item);
    await deleteTimeLog(timeLogId); // Delete locally immediately
    this.notifyListeners();
  }

  // Sync all pending items
  async syncAll(): Promise<void> {
    if (this.isSyncing || !isOnline()) {
      return;
    }

    this.isSyncing = true;
    try {
      const items = await getUnsyncedItems();
      
      for (const item of items) {
        try {
          await this.syncItem(item);
          await markItemSynced(item.id);
          // Delete synced items after a delay
          setTimeout(() => deleteFromSyncQueue(item.id), 5000);
        } catch (error) {
          console.error('Failed to sync item:', item, error);
          // Continue with next item
        }
      }
      
      this.notifyListeners();
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    switch (item.type) {
      case 'button':
        await this.syncButton(item);
        break;
      case 'timelog':
        await this.syncTimeLog(item);
        break;
    }
  }

  private async syncButton(item: SyncQueueItem): Promise<void> {
    const button = item.data as Button;
    
    switch (item.operation) {
      case 'create':
        await buttonApi.create(button);
        break;
      case 'update':
        await buttonApi.update(button.id, button);
        break;
      case 'delete':
        await buttonApi.delete(button.id);
        break;
    }
  }

  private async syncTimeLog(item: SyncQueueItem): Promise<void> {
    const timeLog = item.data as TimeLog;
    
    switch (item.operation) {
      case 'create':
        if (timeLog.is_manual) {
          await timeLogApi.createManual(timeLog);
        } else {
          await timeLogApi.start(timeLog.button_id);
        }
        break;
      case 'update':
        await timeLogApi.update(timeLog.id, timeLog);
        break;
      case 'delete':
        await timeLogApi.delete(timeLog.id);
        break;
    }
  }

  // Add listener for sync events
  onSync(callback: () => void): () => void {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(): void {
    this.syncListeners.forEach(callback => callback());
  }

  // Check if there are pending sync items
  async hasPendingSync(): Promise<boolean> {
    const items = await getUnsyncedItems();
    return items.length > 0;
  }
}

// Export singleton instance
export const syncService = new SyncService();

// Auto-sync when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('App is online, syncing...');
    syncService.syncAll();
  });
}
