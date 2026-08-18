import { 
  addToSyncQueue, 
  getUnsyncedItems, 
  markItemSynced,
  deleteFromSyncQueue,
  saveTimer,
  saveTimeLog,
  saveTarget,
  saveBalance,
  deleteTimer,
  deleteTimeLog,
  deleteTarget,
  deleteBalance,
  getSyncCursor,
  saveSyncCursor,
  getUser,
  getBalanceCalcMeta,
  clearBalanceCalcMeta,
} from '../lib/db';
import { timerApi, timeLogApi, targetApi, balanceApi, isOnline } from './api';
import type { Timer, TimeLog } from '../types';
import type { TargetWithSpecs } from '../types';

type SyncConfig = {
  type: 'timer' | 'timelog' | 'target' | 'balance';
  cursorKey: 'timers' | 'timelogs' | 'targets' | 'balances';
  api: any;
  dataKey: string;
  save: (item: any) => Promise<void>;
  delete: (item: any) => Promise<void>;
  name: string;
};

type BalanceSyncPayload = {
  parent_leave?: number;
  normal_days?: number;
  sick_days?: number;
  holidays?: number;
  business_trip?: number;
  child_sick?: number;
  homeoffice?: number;
  worked_days?: number;
};

export class SyncService {
  private syncingLocks = {
    timer: false,
    timelog: false,
    target: false,
    balance: false,
  };
  private syncListeners: {
    timer: (() => void)[];
    timelog: (() => void)[];
    target: (() => void)[];
    balance: (() => void)[];
  } = {
    timer: [],
    timelog: [],
    target: [],
    balance: [],
  };

  private syncConfigs: SyncConfig[] = [
      {
        type: 'timer',
        cursorKey: 'timers' as const,
        api: timerApi,
        dataKey: 'timers',
        save: saveTimer,
        delete: deleteTimer,
        name: 'timer',
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
        type: 'balance',
        cursorKey: 'balances' as const,
        api: balanceApi,
        dataKey: 'balances',
        save: saveBalance,
        delete: deleteBalance,
        name: 'balance',
      },
    ];

  private normalizeBalancePayload(balance: any): BalanceSyncPayload {
    return {
      ...balance,
      parent_leave: balance.parent_leave ?? 0,
      normal_days: balance.normal_days ?? 0,
      sick_days: balance.sick_days ?? 0,
      holidays: balance.holidays ?? 0,
      business_trip: balance.business_trip ?? 0,
      child_sick: balance.child_sick ?? 0,
      homeoffice: balance.homeoffice ?? 0,
      worked_days: balance.worked_days ?? 0,
    };
  }

  // Generic helper to queue operations
  private async queueOperation(
    type: 'timer' | 'timelog' | 'target' | 'balance',
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
    this.notifyListeners(type);
  }

  // Timer queue operations
  async queueUpsertTimer(timer: Timer): Promise<void> {
    if (!timer.target_id) {
      timer.target_id = null; // Ensure target_id is null if not set, to avoid sync issues
    }
    await this.queueOperation('timer', timer, saveTimer);
  }

  async queueDeleteTimer(timer: Timer): Promise<void> {
    const data = { ...timer, deleted_at: new Date().toISOString() };
    await this.queueOperation('timer', data, deleteTimer);
  }

  // TimeLog queue operations
  async queueUpsertTimeLog(timeLog: TimeLog): Promise<void> {
    delete (timeLog as any).year; // only for local use
    delete (timeLog as any).month; // only for local use
    await this.queueOperation('timelog', timeLog, saveTimeLog);
  }

  async queueDeleteTimeLog(timeLog: TimeLog | string): Promise<void> {
    if (typeof timeLog === 'string') {
      // Backward compatibility - accept id string
      const data = { id: timeLog, deleted_at: new Date().toISOString() };
      await this.queueOperation('timelog', data, () => deleteTimeLog(data as TimeLog));
    } else {
      // Accept full object
      const data = { ...timeLog, deleted_at: new Date().toISOString() };
      await this.queueOperation('timelog', data, () => deleteTimeLog(data as TimeLog));
    }
  }

  // Target queue operations
  async queueUpsertTarget(target: TargetWithSpecs): Promise<void> {
    await this.queueOperation('target', target, saveTarget);
  }

  async queueDeleteTarget(target: TargetWithSpecs): Promise<void> {
    const data = { ...target, deleted_at: new Date().toISOString() };
    await this.queueOperation('target', data, deleteTarget);
  }

  // Balance queue operations
  async queueUpsertBalance(balance: any): Promise<void> {
    await this.queueOperation('balance', this.normalizeBalancePayload(balance), saveBalance);
  }

  async queueDeleteBalance(balance: any): Promise<void> {
    const data = { ...balance, deleted_at: new Date().toISOString() };
    await this.queueOperation('balance', data, deleteBalance);
  }

  // Alias for external calls
  async sync(type: 'all' | 'timer' | 'timelog' | 'target' | 'balance' = 'all'): Promise<void> {
    if (!isOnline()) {
      return;
    }

    const types = type === 'all'
      ? ['timer', 'timelog', 'target', 'balance']
      : [type];

    const notSyncing = types.filter(t => !this.syncingLocks[t as keyof typeof this.syncingLocks]);

    if (notSyncing.length === 0) {
      return;
    }

    // Check if user is logged in
    const user = await getUser();
    if (!user) {
      return;
    }

    for (const t of notSyncing) {
      this.syncingLocks[t as keyof typeof this.syncingLocks] = true;
    }
    try {
      const configs = this.syncConfigs.filter(config => 
        notSyncing.includes(config.type)
      );
      // Phase 1: Push local changes to server
      await this.pushLocalChanges(configs);
      
      // Phase 2: Pull server changes since last sync
      await this.pullServerChanges(configs);
      
      notSyncing.forEach(t => this.notifyListeners(t as keyof typeof this.syncListeners));
    } finally {
      for (const t of notSyncing) {
        this.syncingLocks[t as keyof typeof this.syncingLocks] = false;
      }
      console.log('Sync completed for types:', notSyncing);
    }
  }

  private async pullChanges(
    cursorKey: 'timers' | 'timelogs' | 'targets' | 'balances',
    api: any,
    dataKey: string,
    save: (item: any) => Promise<void>,
    deleteItem: (item: any) => Promise<void>,
  ): Promise<boolean> {
    let cursor = await getSyncCursor(cursorKey);
    if (!cursor) {
      // First sync - use epoch time to get all data
      cursor = new Date(0).toISOString();
    }

    const result = await api.getSyncChanges(cursor);

    const items = result[dataKey] || [];

    // Update local DB with server changes
    const promises = [];
    for (const item of items) {
      if ((item as any).deleted_at) {
        // Item was deleted on server - pass full item to delete helper
        promises.push(deleteItem(item));
      } else {
        promises.push(save(item));
      }
    }
    await Promise.all(promises);

    // Save new cursor
    await saveSyncCursor(cursorKey, result.cursor);

    return items.length > 0;
  }

  private async pushChanges(
    cursor: 'timers' | 'timelogs' | 'targets' | 'balances',
    data: any[],
    api: any,
    save: (item: any) => Promise<void>,
  ): Promise<void> {
    // data is an array of SyncQueueItem objects
    // Remove user_id from payload as server sets it from session
    const payload = data.map((qi: any) => {
      const { user_id, ...rest } = qi.data;
      if (cursor === 'balances') {
        return this.normalizeBalancePayload(rest);
      }
      return rest;
    });

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
        // TODO: delete if marked as deleted
        await save(item);
      }
    }

    // Handle conflicts — balances are always authoritative from the client
    // (recalculated locally), so conflicts are not applicable for them.
    if (cursor !== 'balances' && result.conflicts && result.conflicts.length > 0) {
      console.warn(cursor, 'sync conflicts detected:', result.conflicts);
      // In a real app, you'd want to show these to the user
      // For now, we'll use server version (last-write-wins)
      for (const conflict of result.conflicts) {
        await save(conflict.serverVersion);
      }
    }
  }

  // Push local queued changes to server
  private async pushLocalChanges(typeConfigs: SyncConfig[]): Promise<void> {
    const items = await getUnsyncedItems();
    const promises = [];

    // Push changes for each type
    for (const config of typeConfigs) {
      const typeItems = items.filter(item => item.type === config.type);
      
      if (typeItems.length > 0) {
        promises.push(
          this.pushChanges(config.cursorKey, typeItems,
            config.api, config.save)
        );
      }
    }
    await Promise.all(promises);
  }

  // Pull server changes since last cursor
  private async pullServerChanges(typeConfigs: SyncConfig[]): Promise<void> {
    let sourceDataChanged = false;

    // Pull changes for each type (except balance, which is handled specially)
    const nonBalanceConfigs = typeConfigs.filter(c => c.type !== 'balance');
    const balanceConfig = typeConfigs.find(c => c.type === 'balance');

    const promises = nonBalanceConfigs.map(async (config) => {
      const changed = await this.pullChanges(
        config.cursorKey,
        config.api,
        config.dataKey,
        config.save,
        config.delete
      );
      if (changed && (config.type === 'timelog' || config.type === 'target')) {
        sourceDataChanged = true;
      }
    });
    await Promise.all(promises);

    // If timelogs or targets changed from server, invalidate balance calc
    // metadata so balances will be recalculated from source-of-truth locally
    if (sourceDataChanged) {
      await clearBalanceCalcMeta();
    }

    // Only pull balances from server on initial seed (no local calc metadata).
    // After the first calculation, local balances are the source of truth and
    // are pushed to server for other devices to seed from.
    // Also skip balance pull when source data changed — balances will be
    // recalculated locally from the new timelogs/targets.
    if (balanceConfig) {
      const shouldSkipBalancePull = sourceDataChanged;
      let hasLocalCalculations = shouldSkipBalancePull;

      if (!shouldSkipBalancePull) {
        const meta = await getBalanceCalcMeta();
        hasLocalCalculations = !!(meta && Object.keys(meta.targets).length > 0);
      }

      if (!hasLocalCalculations) {
        await this.pullChanges(
          balanceConfig.cursorKey,
          balanceConfig.api,
          balanceConfig.dataKey,
          balanceConfig.save,
          balanceConfig.delete
        );
      } else {
        // Still update the cursor so we don't re-pull old data on next initial seed
        const cursor = await getSyncCursor(balanceConfig.cursorKey);
        if (!cursor) {
          await saveSyncCursor(balanceConfig.cursorKey, new Date(0).toISOString());
        }
      }
    }
  }

  // Add listener for sync events
  afterSync(
    type: 'timer' | 'timelog' | 'target' | 'balance',
    callback: () => void
  ) {
    console.log('Registering sync listener for', type);
    this.syncListeners[type].push(callback);
  }

  private notifyListeners(type: 'timer' | 'timelog' | 'target' | 'balance'): void {
    this.syncListeners[type].forEach(callback => callback());
  }

  // Check if there are pending sync items
  async hasPendingSync(): Promise<boolean> {
    const items = await getUnsyncedItems();
    return items.length > 0;
  }
}

// Export singleton instance
export const syncService = new SyncService();
