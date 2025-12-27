import { derived } from 'svelte/store';
import type { TargetWithSpecs } from '../types';
import { saveTarget, getAllTargets, deleteTarget as deleteTargetDB } from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig } from './base-store';
import { holidaysStore } from './holidays';
import dayjs from '../../../lib/utils/dayjs.js';

// Configure the base store for targets
const targetStoreConfig: BaseStoreConfig<TargetWithSpecs> = {
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
      // Collect all state codes from target_specs
      const stateCodes: string[] = [];
      for (const target of items) {
        for (const spec of target.target_specs || []) {
          if (spec.state_code) {
            stateCodes.push(spec.state_code);
          }
        }
      }
      if (stateCodes.length > 0) {
        holidaysStore.fetchHolidaysForStates(
          stateCodes,
          dayjs().year(),
        );
      }
      return items;
    },
  },
  storeName: 'Target',
};

// Create the base store
const baseStore = createBaseStore<TargetWithSpecs>(targetStoreConfig);

// Create the targets store with custom create method
function createTargetsStore() {
  return {
    ...baseStore,

    async create(targetData: Partial<TargetWithSpecs>) {
      return baseStore.create({
        id: crypto.randomUUID(),
        user_id: '',
        name: targetData.name || '',
        target_specs: targetData.target_specs || [],
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

// Derived store for today's targets (those with active target_specs for today)
export const todayTargets = derived(
  targetsStore,
  ($targetsStore) => {
    const today = dayjs();
    const todayWeekday = today.day(); // 0=Sunday, 6=Saturday
    const todayStr = today.format('YYYY-MM-DD');
    
    return $targetsStore.items.filter(target => {
      // Check if any target_spec is active for today
      for (const spec of target.target_specs || []) {
        const startDate = dayjs(spec.starting_from);
        const endDate = spec.ending_at ? dayjs(spec.ending_at) : null;
        
        // Check date range
        if (today.isBefore(startDate, 'day')) continue;
        if (endDate && today.isAfter(endDate, 'day')) continue;
        
        // Check weekday
        if (spec.weekdays.includes(todayWeekday)) {
          return true;
        }
      }
      return false;
    });
  }
);
