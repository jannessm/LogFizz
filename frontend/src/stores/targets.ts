import { writable, derived, get } from 'svelte/store';
import type { DailyTarget } from '../types';
import { saveTarget, getAllTargets, deleteTarget as deleteTargetDB } from '../lib/db';
import { syncService } from '../services/sync';
import { targetApi, isOnline } from '../services/api';

interface TargetsStore {
  targets: DailyTarget[];
  isLoading: boolean;
  error: string | null;
}

async function upsertTarget(target: DailyTarget) {
  await saveTarget(target);
  await syncService.queueUpsertTarget(target);
  if (isOnline()) {
    syncService.sync('target');
  }
}

async function deleteTarget(target: DailyTarget) {
  await deleteTargetDB(target);
  await syncService.queueDeleteTarget(target);
  if (isOnline()) {
    syncService.sync('target');
  }
}

function createTargetsStore() {
  const { subscribe, set, update } = writable<TargetsStore>({
    targets: [],
    isLoading: false,
    error: null,
  });

  return {
    subscribe,
    
    async load() {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        // Load from local DB first
        const localTargets = await getAllTargets();
        update(state => ({ ...state, targets: localTargets.filter(t => !t.deleted_at), isLoading: false }));

        // Try to pull incremental changes from server if online (in the background)
        if (isOnline()) {
          await syncService.sync('target');
        }
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
      }
    },

    async create(targetData: Partial<DailyTarget>) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const target: DailyTarget = {
          id: crypto.randomUUID(),
          user_id: '',
          name: targetData.name || '',
          duration_minutes: targetData.duration_minutes || [60], // Default to 60 minutes
          weekdays: targetData.weekdays || [1, 2, 3, 4, 5], // Default to weekdays
          exclude_holidays: targetData.exclude_holidays || false,
          state_code: targetData.state_code,
          starting_from: targetData.starting_from,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await upsertTarget(target);
        
        // Update UI
        update(state => ({ 
          ...state, 
          targets: [...state.targets, target],
          isLoading: false 
        }));
        
        return target;
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },

    async update(id: string, targetData: Partial<DailyTarget>) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const targets = get<TargetsStore>(this).targets;
        const index = targets.findIndex(t => t.id === id);
        if (index === -1) throw new Error(`Target ${id} not found`);

        const updatedTarget: DailyTarget = {
          ...targets[index],
          ...targetData,
          updated_at: new Date().toISOString(),
        };

        await upsertTarget(updatedTarget);
        
        // Update UI
        update(state => ({ 
          ...state, 
          targets: state.targets.map(t => t.id === id ? updatedTarget : t),
          isLoading: false 
        }));
        
        return updatedTarget;
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },

    async delete(target: DailyTarget) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        await deleteTarget(target);
        
        // Remove from UI immediately
        update(state => ({ 
          ...state, 
          targets: state.targets.filter(t => t.id !== target.id),
          isLoading: false 
        }));
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },

    clearError() {
      update(state => ({ ...state, error: null }));
    },
  };
}

export const targetsStore = createTargetsStore();

// Derived store for today's targets
export const todayTargets = derived(
  targetsStore,
  ($targetsStore) => {
    const today = new Date().getDay();
    return $targetsStore.targets.filter(t => t.weekdays.includes(today));
  }
);
