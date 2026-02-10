import { derived, get } from 'svelte/store';
import type { TargetWithSpecs } from '../types';
import { saveTarget, getAllTargets, deleteTarget as deleteTargetDB } from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig, mapToArray } from './base-store';
import { holidaysStore } from './holidays';
import { timers } from './timers'; 
import dayjs from '../../../lib/utils/dayjs.js';

/**
 * Configuration for the targets store
 * Targets define work schedules with target hours per weekday
 * Each target contains nested target_specs for different date ranges
 */
const targetStoreConfig: BaseStoreConfig<TargetWithSpecs> = {
  db: {
    getAll: getAllTargets,
    save: saveTarget,
    delete: deleteTargetDB,
  },
  sync: {
    queueUpsert: syncService.queueUpsertTarget.bind(syncService),
    queueDelete: syncService.queueDeleteTarget.bind(syncService),
    syncType: 'target',
  },
  hooks: {
    afterLoad: (items) => {
      // Pre-fetch holidays for all state codes referenced in target_specs
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

const baseStore = createBaseStore<TargetWithSpecs>(targetStoreConfig);

/**
 * Creates the targets store with custom create method
 * @returns Enhanced targets store with CRUD operations
 */
function createTargetsStore() {
  return {
    ...baseStore,

    /**
     * Create a new target with nested target_specs
     * @param targetData - Partial target data
     * @returns Created target
     */
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

    async getTargetsByTimerIds(timerIds: string[]): Promise<TargetWithSpecs[]> {
      if (timerIds.length == 0) {
        return [];
      }

      const _targets = get(targets);
      const _timers = get(timers).filter(t => !!timerIds.find(i => t.id == i));
      
      if (_timers.length == 0) {
        return [];
      }
      return _targets.filter(target => _timers.find(t => target.id == t.target_id));
    }
  };
}

/** Main targets store - manages work schedule targets */
export const targetsStore = createTargetsStore();

/** Derived store providing direct access to targets array */
export const targets = derived(
  targetsStore,
  ($store) => mapToArray($store.items)
);

/**
 * Derived store for targets active today
 * Filters targets that have a target_spec matching today's date and weekday
 */
export const todayTargets = derived(
  targetsStore,
  ($targetsStore) => {
    const today = dayjs();
    const todayWeekday = today.day(); // 0=Sunday, 6=Saturday
    
    return mapToArray($targetsStore.items).filter(target => {
      for (const spec of target.target_specs || []) {
        const startDate = dayjs(spec.starting_from);
        const endDate = spec.ending_at ? dayjs(spec.ending_at) : null;
        
        if (today.isBefore(startDate, 'day')) continue;
        if (endDate && today.isAfter(endDate, 'day')) continue;
        
        // Check if today has a duration > 0 in this spec
        if (spec.duration_minutes[todayWeekday] > 0) {
          return true;
        }
      }
      return false;
    });
  }
);
