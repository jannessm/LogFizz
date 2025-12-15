import { derived } from 'svelte/store';
import type { DailyTarget } from '../types';
import { saveTarget, getAllTargets, deleteTarget as deleteTargetDB } from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig } from './base-store';
import { holidaysStore } from './holidays';
import dayjs from '../../../lib/utils/dayjs.js';

// Configure the base store for targets
const targetStoreConfig: BaseStoreConfig<DailyTarget> = {
  db: {
    getAll: getAllTargets,
    save: saveTarget,
    delete: deleteTargetDB,
  },
  sync: {
    queueUpsert: (target) => syncService.queueUpsertTarget(target),
    queueDelete: (target) => syncService.queueDeleteTarget(target),
    syncType: 'target',
  },
  hooks: {
    afterLoad: (items) => {
      holidaysStore.fetchHolidaysForStates(
        items.map(t => t.state_code).filter(Boolean) as string[],
        dayjs().year(),
      );
      return items;
    },
  },
  storeName: 'Target',
};

// Create the base store
const baseStore = createBaseStore<DailyTarget>(targetStoreConfig);

// Create the targets store with custom create method
function createTargetsStore() {
  return {
    ...baseStore,

    async create(targetData: Partial<DailyTarget>) {
      return baseStore.create({
        id: crypto.randomUUID(),
        user_id: '',
        name: targetData.name || '',
        duration_minutes: targetData.duration_minutes || [60], // Default to 60 minutes
        weekdays: targetData.weekdays || [1, 2, 3, 4, 5], // Default to weekdays
        exclude_holidays: targetData.exclude_holidays || false,
        state_code: targetData.state_code,
        starting_from: targetData.starting_from,
        ending_at: targetData.ending_at,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },
  };
}

export const targetsStore = createTargetsStore();

// Derived store for backward compatibility
export const targets = derived(
  targetsStore,
  ($store) => $store.items
);

// Derived store for today's targets
export const todayTargets = derived(
  targetsStore,
  ($targetsStore) => {
    const today = new Date().getDay();
    return $targetsStore.items.filter(t => t.weekdays.includes(today));
  }
);
