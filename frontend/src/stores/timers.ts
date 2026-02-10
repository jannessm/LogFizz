import { derived, get } from 'svelte/store';
import type { Timer, TimeLog } from '../types';
import { getAllTimers, saveTimer as saveTimerDB, deleteTimer as deleteTimerDB } from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig, mapToArray } from './base-store';
import dayjs from '../../../lib/utils/dayjs.js';

/**
 * Configuration for the timers store
 * Timers represent trackable activities (e.g., "Work", "Exercise")
 */
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

const baseStore = createBaseStore<Timer>(timerStoreConfig);

/**
 * Creates the timers store with custom create method
 * @returns Enhanced timer store with CRUD operations
 */
function createTimersStore() {
  return {
    ...baseStore,

    /**
     * Create a new timer with default values
     * @param timerData - Partial timer data to create
     * @returns Created timer
     */
    async create(timerData: Partial<Timer>) {
      return baseStore.create({
        id: crypto.randomUUID(),
        user_id: '', // Will be set by backend
        name: timerData.name || '',
        emoji: timerData.emoji,
        color: timerData.color,
        auto_subtract_breaks: timerData.auto_subtract_breaks ?? false,
        archived: timerData.archived ?? false,
        target_id: timerData.target_id, // Include target_id
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString(),
      });
    },
  };
}

/** Main timers store - manages timer CRUD operations */
export const timersStore = createTimersStore();

/** Derived store providing direct access to timers array */
export const timers = derived(
  timersStore,
  ($store) => mapToArray($store.items)
);

/**
 * Derived store for active timers (timers with no running timelog)
 * A timer is active if it has no timelog with end_timestamp === undefined
 */
export const activeTimers = derived(
  timersStore,
  ($store) => {
    // Import here to avoid circular dependency issues
    const { activeTimeLogs } = require('./timelogs.js');
    const activeTimelogs = get(activeTimeLogs) as TimeLog[];
    const runningTimerIds = new Set(activeTimelogs.map((tl: any) => tl.timer_id));
    return mapToArray($store.items).filter(t => !runningTimerIds.has(t.id));
  }
);

export const nonArchivedTimers = derived(
  timersStore,
  ($store) => mapToArray($store.items).filter(t => !t.archived)
);

export const archivedTimers = derived(
  timersStore,
  ($store) => mapToArray($store.items).filter(t => t.archived)
);
