import { 
  addToSyncQueue, 
  getUnsyncedItems, 
  markItemSynced,
  deleteFromSyncQueue,
  saveButton,
  saveTimeLog,
  saveTarget,
  deleteButton,
  deleteTimeLog,
  deleteTarget,
  getSyncCursor,
  saveSyncCursor,
  getUser,
  getAllTimeLogs,
} from '../lib/db';
import { buttonApi, timeLogApi, isOnline } from './api';
import type { Button, TimeLog, DailyTarget, SyncQueueItem } from '../types';
import { validateAndFixTimelogs } from '../lib/buttonLayout';

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

  async queueTargetCreate(target: DailyTarget): Promise<void> {
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      type: 'target' as any,
      operation: 'create',
      data: target,
      timestamp: Date.now(),
      synced: false,
    };
    await addToSyncQueue(item);
    await saveTarget(target);
    this.notifyListeners();
  }

  async queueTargetUpdate(id: string, targetData: Partial<DailyTarget>): Promise<void> {
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      type: 'target' as any,
      operation: 'update',
      data: { id, ...targetData },
      timestamp: Date.now(),
      synced: false,
    };
    await addToSyncQueue(item);
    this.notifyListeners();
  }

  async queueTargetDelete(targetId: string): Promise<void> {
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      type: 'target' as any,
      operation: 'delete',
      data: { id: targetId },
      timestamp: Date.now(),
      synced: false,
    };
    await addToSyncQueue(item);
    await deleteTarget(targetId);
    this.notifyListeners();
  }

  // Sync all pending items using cursor-based approach
  async syncAll(): Promise<void> {
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
      await this.pushLocalChanges();
      
      // Phase 2: Pull server changes since last sync
      await this.pullServerChanges();
      
      this.notifyListeners();
    } finally {
      this.isSyncing = false;
    }
  }

  // Push local queued changes to server
  private async pushLocalChanges(): Promise<void> {
    const items = await getUnsyncedItems();
    
    // Group items by type
    const buttonItems = items.filter(item => item.type === 'button');
    const timeLogItems = items.filter(item => item.type === 'timelog');

    // Push buttons
    if (buttonItems.length > 0) {
      try {
        const buttons = buttonItems.map(item => ({
          ...item.data,
          updated_at: new Date(item.timestamp).toISOString(),
          deleted_at: item.operation === 'delete' ? new Date(item.timestamp).toISOString() : undefined,
        }));
        
        const result = await buttonApi.pushSyncChanges(buttons);
        
        // Save the new cursor
        await saveSyncCursor('buttons', result.cursor);
        
        // Mark items as synced and delete from queue
        for (const item of buttonItems) {
          await markItemSynced(item.id);
          setTimeout(() => deleteFromSyncQueue(item.id), 5000);
        }
        
        // Update local DB with server-confirmed data
        if (result.saved) {
          for (const button of result.saved) {
            await saveButton(button);
          }
        }
        
        // Handle conflicts
        if (result.conflicts && result.conflicts.length > 0) {
          console.warn('Button sync conflicts detected:', result.conflicts);
          // In a real app, you'd want to show these to the user
          // For now, we'll use server version (last-write-wins)
          for (const conflict of result.conflicts) {
            await saveButton(conflict.serverVersion);
          }
        }
      } catch (error) {
        console.error('Failed to push button changes:', error);
      }
    }

    // Push time logs
    if (timeLogItems.length > 0) {
      try {
        let timeLogs = timeLogItems.map(item => ({
          ...item.data,
          updated_at: new Date(item.timestamp).toISOString(),
          deleted_at: item.operation === 'delete' ? new Date(item.timestamp).toISOString() : undefined,
        }));
        
        // Validate and fix overlapping timelogs before pushing
        // This ensures a button is stopped before being started again
        timeLogs = validateAndFixTimelogs(timeLogs);
        
        const result = await timeLogApi.pushSyncChanges(timeLogs);
        
        // Save the new cursor
        await saveSyncCursor('timelogs', result.cursor);
        
        // Mark items as synced and delete from queue
        for (const item of timeLogItems) {
          await markItemSynced(item.id);
          setTimeout(() => deleteFromSyncQueue(item.id), 5000);
        }
        
        // Update local DB with server-confirmed data
        if (result.saved) {
          for (const timeLog of result.saved) {
            await saveTimeLog(timeLog);
          }
        }
        
        // Handle conflicts
        if (result.conflicts && result.conflicts.length > 0) {
          console.warn('TimeLog sync conflicts detected:', result.conflicts);
          // Use server version (last-write-wins)
          for (const conflict of result.conflicts) {
            await saveTimeLog(conflict.serverVersion);
          }
        }
      } catch (error) {
        console.error('Failed to push timelog changes:', error);
      }
    }
  }

  // Pull server changes since last cursor
  private async pullServerChanges(): Promise<void> {
    try {
      // Pull button changes
      let buttonCursor = await getSyncCursor('buttons');
      if (!buttonCursor) {
        // First sync - use epoch time to get all data
        buttonCursor = new Date(0).toISOString();
      }
      
      const buttonResult = await buttonApi.getSyncChanges(buttonCursor);
      
      // Update local DB with server changes
      for (const button of buttonResult.buttons) {
        if ((button as any).deleted_at) {
          // Button was deleted on server
          await deleteButton(button.id);
        } else {
          await saveButton(button);
        }
      }
      
      // Save new cursor
      await saveSyncCursor('buttons', buttonResult.cursor);
      
    } catch (error) {
      console.error('Failed to pull button changes:', error);
    }

    try {
      // Pull timelog changes
      let timeLogCursor = await getSyncCursor('timelogs');
      if (!timeLogCursor) {
        // First sync - use epoch time to get all data
        timeLogCursor = new Date(0).toISOString();
      }
      
      const timeLogResult = await timeLogApi.getSyncChanges(timeLogCursor);
      
      // Update local DB with server changes
      for (const timeLog of timeLogResult.timeLogs) {
        if ((timeLog as any).deleted_at) {
          // TimeLog was deleted on server
          await deleteTimeLog(timeLog.id);
        } else {
          await saveTimeLog(timeLog);
        }
      }
      
      // Save new cursor
      await saveSyncCursor('timelogs', timeLogResult.cursor);
      
    } catch (error) {
      console.error('Failed to pull timelog changes:', error);
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
