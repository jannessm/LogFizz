import { 
  addToSyncQueue, 
  getUnsyncedItems, 
  markItemSynced,
  deleteFromSyncQueue,
  saveButton,
  saveTimeLog,
  saveTarget,
  saveMonthlyBalance,
  deleteButton,
  deleteTimeLog,
  deleteTarget,
  deleteMonthlyBalance,
  getSyncCursor,
  saveSyncCursor,
  getUser,
} from '../lib/db';
import { buttonApi, timeLogApi, targetApi, monthlyBalanceApi, isOnline } from './api';
import type { Button, TimeLog, DailyTarget } from '../types';
import { validateAndFixTimelogs } from '../lib/buttonLayout';

export class SyncService {
  private isSyncing = false;
  private syncListeners: (() => void)[] = [];

  private syncConfigs = [
      {
        type: 'button',
        cursorKey: 'buttons' as const,
        api: buttonApi,
        dataKey: 'buttons',
        save: saveButton,
        delete: deleteButton,
        name: 'button',
      },
      {
        type: 'timelog',
        cursorKey: 'timelogs' as const,
        api: timeLogApi,
        dataKey: 'timeLogs',
        save: saveTimeLog,
        delete: deleteTimeLog,
        name: 'timelog',
      },
      {
        type: 'target',
        cursorKey: 'targets' as const,
        api: targetApi,
        dataKey: 'targets',
        save: saveTarget,
        delete: deleteTarget,
        name: 'target',
      },
      {
        type: 'monthlyBalance',
        cursorKey: 'monthlyBalances' as const,
        api: monthlyBalanceApi,
        dataKey: 'monthlyBalances',
        save: saveMonthlyBalance,
        delete: deleteMonthlyBalance,
        name: 'monthly balance',
      },
    ];

  // Generic helper to queue operations
  private async queueOperation(
    type: 'button' | 'timelog' | 'target' | 'monthlyBalance',
    data: any,
    save: (item: any) => Promise<void>
  ): Promise<void> {
    data.updated_at = new Date().toISOString();
    await addToSyncQueue({
      id: crypto.randomUUID(),
      type,
      data,
      synced: false,
    });

    await save(data);
    this.notifyListeners();
  }

  // Button queue operations
  async queueUpsertButton(button: Button): Promise<void> {
    await this.queueOperation('button', button, saveButton);
  }

  async queueDeleteButton(button: Button): Promise<void> {
    const data = { ...button, deleted_at: new Date().toISOString() };
    await this.queueOperation('button', data, deleteButton);
  }

  // TimeLog queue operations
  async queueUpsertTimeLog(timeLog: TimeLog): Promise<void> {
    await this.queueOperation('timelog', timeLog, saveTimeLog);
  }

  async queueDeleteTimeLog(timeLogId: string): Promise<void> {
    const data = { id: timeLogId, deleted_at: new Date().toISOString() };
    await this.queueOperation('timelog', data, deleteTimeLog);
  }

  // Target queue operations
  async queueUpsertTarget(target: DailyTarget): Promise<void> {
    await this.queueOperation('target', target, saveTarget);
  }

  async queueDeleteTarget(targetId: string): Promise<void> {
    const data = { id: targetId, deleted_at: new Date().toISOString() };
    await this.queueOperation('target', data, deleteTarget);
  }

  // Monthly Balance queue operations
  async queueUpsertMonthlyBalance(monthlyBalance: any): Promise<void> {
    await this.queueOperation('monthlyBalance', monthlyBalance, saveMonthlyBalance);
  }

  async queueDeleteMonthlyBalance(balanceId: string): Promise<void> {
    const data = { id: balanceId, deleted_at: new Date().toISOString() };
    await this.queueOperation('monthlyBalance', data, deleteMonthlyBalance);
  }

  // Sync all pending items using cursor-based approach
  async syncAll(type: 'all' | 'button' | 'timelog' | 'target' | 'monthlyBalance' = 'all'): Promise<void> {
    if (this.isSyncing || !isOnline()) {
      return;
    }

    // Check if user is logged in
    const user = await getUser();
    if (!user) {
      console.log('Skipping sync: user not logged in');
      return;
    }

    this.isSyncing = true;
    try {
      // Phase 1: Push local changes to server
      await this.pushLocalChanges(type);
      
      // Phase 2: Pull server changes since last sync
      await this.pullServerChanges(type);
      
      this.notifyListeners();
    } finally {
      this.isSyncing = false;
    }
  }

  // Alias for external calls
  async sync(type: 'all' | 'button' | 'timelog' | 'target' | 'monthlyBalance' = 'all'): Promise<void> {
    return this.syncAll(type);
  }

  private async pullChanges(
    cursorKey: 'buttons' | 'timelogs' | 'targets' | 'monthlyBalances',
    api: any,
    dataKey: string,
    save: (item: any) => Promise<void>,
    deleteItem: (item: any) => Promise<void>,
  ): Promise<void> {
    let cursor = await getSyncCursor(cursorKey);
    if (!cursor) {
      // First sync - use epoch time to get all data
      cursor = new Date(0).toISOString();
    }

    const result = await api.getSyncChanges(cursor);

    // Update local DB with server changes
    for (const item of result[dataKey]) {
      if ((item as any).deleted_at) {
        // Item was deleted on server - pass full item to delete helper
        await deleteItem(item);
      } else {
        await save(item);
      }
    }

    // Save new cursor
    await saveSyncCursor(cursorKey, result.cursor);
  }

  private async pushChanges(
    cursor: 'buttons' | 'timelogs' | 'targets' | 'monthlyBalances',
    data: any[],
    api: any,
    save: (item: any) => Promise<void>,
  ): Promise<void> {
    // data is an array of SyncQueueItem objects
    const payload = data.map((qi: any) => qi.data);

    const result = await api.pushSyncChanges(payload);

    // Save the new cursor
    await saveSyncCursor(cursor, result.cursor);

    // remove item from sync queue since conflict alters local database
    // TODO: should keep track of local changes for proper conflict handling
    for (const qi of data) {
      await markItemSynced(qi.id);
      setTimeout(() => deleteFromSyncQueue(qi.id), 5000);
    }

    // Update local DB with server-confirmed data
    if (result.saved) {
      for (const item of result.saved) {
        await save(item);
      }
    }
    
    // Handle conflicts
    if (result.conflicts && result.conflicts.length > 0) {
      console.warn(cursor, 'sync conflicts detected:', result.conflicts);
      // In a real app, you'd want to show these to the user
      // For now, we'll use server version (last-write-wins)
      for (const conflict of result.conflicts) {
        await save(conflict.serverVersion);
      }
    }
  }

  // Push local queued changes to server
  private async pushLocalChanges(type: 'all' | 'button' | 'timelog' | 'target' | 'monthlyBalance' = 'all'): Promise<void> {
    const items = await getUnsyncedItems();

    // Filter configs based on type parameter
    const filteredConfigs = type === 'all' 
      ? this.syncConfigs 
      : this.syncConfigs.filter(config => config.type === type);

    // Push changes for each type
    for (const config of filteredConfigs) {
      const typeItems = items.filter(item => item.type === config.type);
      
      if (typeItems.length > 0) {
        try {
          await this.pushChanges(config.cursorKey, typeItems, config.api, config.save);
        } catch (error) {
          console.error(`Failed to push ${config.name} changes:`, error);
        }
      }
    }
  }

  // Pull server changes since last cursor
  private async pullServerChanges(type: 'all' | 'button' | 'timelog' | 'target' | 'monthlyBalance' = 'all'): Promise<void> {

    // Filter configs based on type parameter
    const filteredConfigs = type === 'all' 
      ? this.syncConfigs 
      : this.syncConfigs.filter(config => config.type === type);

    // Pull changes for each type
    for (const config of filteredConfigs) {
      try {
        await this.pullChanges(
          config.cursorKey,
          config.api,
          config.dataKey,
          config.save,
          config.delete
        );
      } catch (error) {
        console.error(`Failed to pull ${config.name} changes:`, error);
      }
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

// Auto-sync when coming online (if authenticated)
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    const user = await getUser();
    if (user) {
      console.log('App is online, syncing...');
      syncService.syncAll();
    }
  });
}
