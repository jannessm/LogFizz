import { derived, get } from 'svelte/store';
import type { Timer, TimeLog } from '../types';
import { getAllTimers, saveTimer as saveTimerDB, deleteTimer as deleteTimerDB } from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig } from './base-store';
import dayjs from '../../../lib/utils/dayjs.js';

// Configure the base store for timers
const timerStoreConfig: BaseStoreConfig<Timer> = {
  db: {
    getAll: getAllTimers,
    save: saveTimerDB,
    delete: deleteTimerDB,
  },
  sync: {
    queueUpsert: syncService.queueUpsertTimer.bind(syncService),
    queueDelete: syncService.queueDeleteTimer.bind(syncService),
    syncType: 'timer',
  },
  storeName: 'Timer',
};

// Create the base store
const baseStore = createBaseStore<Timer>(timerStoreConfig);

// Create the timers store with custom create method
function createTimersStore() {
  return {
    ...baseStore,

    async create(timerData: Partial<Timer>) {
      return baseStore.create({
        id: crypto.randomUUID(),
        user_id: '', // Will be set by backend
        name: timerData.name || '',
        emoji: timerData.emoji,
        color: timerData.color,
        auto_subtract_breaks: timerData.auto_subtract_breaks ?? false,
        archived: timerData.archived ?? false,
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString(),
      });
    },
  };
}

export const timersStore = createTimersStore();

// Derived store for timers (maps 'items' to 'timers' for backward compatibility)
export const timers = derived(
  timersStore,
  ($store) => $store.items
);

// Derived store for active timers (timers with no running timelog)
// A timer is active if it has no timelog with end_timestamp === undefined
export const activeTimers = derived(
  timersStore,
  ($store) => {
    // Import here to avoid circular dependency issues
    const { activeTimeLogs } = require('./timelogs.js');
    const activeTimelogs = get(activeTimeLogs) as TimeLog[];
    const runningTimerIds = new Set(activeTimelogs.map((tl: any) => tl.timer_id));
    return $store.items.filter(t => !runningTimerIds.has(t.id));
  }
);
