import { derived, get } from 'svelte/store';
import type { TargetWithSpecs } from '../types';
import { saveTarget, getAllTargets, deleteTarget as deleteTargetDB, clearBalanceCalcMeta } from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig, mapToArray } from './base-store';
import { holidaysStore } from './holidays';
import { timers } from './timers'; 
import dayjs from '../../../lib/utils/dayjs.js';

/**
 * Check if any target spec dates or duration have changed between old and new target
 * @param oldTarget - Previous target state
 * @param newTarget - New target state
 * @returns true if any spec dates or durations changed
 */
function hasTargetSpecsChanged(oldTarget: TargetWithSpecs | undefined, newTarget: TargetWithSpecs): boolean {
  if (!oldTarget) return true;
  
  const oldSpecs = oldTarget.target_specs || [];
  const newSpecs = newTarget.target_specs || [];
  
  // If number of specs changed, recalculate
  if (oldSpecs.length !== newSpecs.length) return true;
  
  // Check each spec for date or duration changes
  for (const newSpec of newSpecs) {
    const oldSpec = oldSpecs.find(s => s.id === newSpec.id);
    
    // New spec added
    if (!oldSpec) return true;
    
    // Check if dates changed
    if (oldSpec.starting_from !== newSpec.starting_from) return true;
    if (oldSpec.ending_at !== newSpec.ending_at) return true;
    
    // Check if duration_minutes changed (any day of the week)
    if (oldSpec.duration_minutes.length !== newSpec.duration_minutes.length) return true;
    for (let i = 0; i < 7; i++) {
      if (oldSpec.duration_minutes[i] !== newSpec.duration_minutes[i]) return true;
    }
    
    // Check if exclude_holidays or state_code changed (affects due minutes)
    if (oldSpec.exclude_holidays !== newSpec.exclude_holidays) return true;
    if (oldSpec.state_code !== newSpec.state_code) return true;
  }
  
  // Check if any old spec was removed
  for (const oldSpec of oldSpecs) {
    if (!newSpecs.find(s => s.id === oldSpec.id)) return true;
  }
  
  return false;
}

/**
 * Configuration for the targets store
 * Targets define work schedules with target hours per weekday
 * Each target contains nested target_specs for different date ranges
 */

// Store the previous target state before update for comparison
let targetBeforeUpdate: TargetWithSpecs | undefined;

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
    beforeUpdate: (target, state) => {
      // Store the previous state for comparison in afterUpdate
      targetBeforeUpdate = state.items.get(target.id);
    },
    afterUpdate: async (target) => {
      // Check if target specs changed and trigger balance recalculation
      if (hasTargetSpecsChanged(targetBeforeUpdate, target)) {
        console.log(`Target specs changed for ${target.id}, clearing balance metadata for recalculation`);
        // Clear balance calculation metadata for this target
        // This will force balances to be recalculated on next ensureBalancesUpToDate call
        await clearBalanceCalcMeta(target.id);
        
        // Import balancesStore dynamically to avoid circular dependency
        const { balancesStore } = await import('./balances');
        await balancesStore.recalculateBalances(target.id);
      }
      targetBeforeUpdate = undefined;
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
        id: targetData.id || crypto.randomUUID(),
        user_id: '',
        name: targetData.name || '',
        target_specs: targetData.target_specs || [],
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString(),
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
