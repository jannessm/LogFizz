import { writable, derived } from 'svelte/store';
import type { DailyTarget } from '../types';
import { saveTarget, getAllTargets, deleteTarget as deleteTargetDB, getSyncCursor, saveSyncCursor } from '../lib/db';
import { syncService } from '../services/sync';
import { targetApi, isOnline } from '../services/api';

interface TargetsStore {
  targets: DailyTarget[];
  isLoading: boolean;
  error: string | null;
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

        // Try to pull incremental changes from server if online
        if (isOnline()) {
          try {
            // Get last sync cursor
            let cursor = await getSyncCursor('targets');
            if (!cursor) {
              // First sync - use epoch time to get all data
              cursor = new Date(0).toISOString();
            }
            
            const result = await targetApi.getSyncChanges(cursor);
            
            // Apply changes to local DB
            for (const target of result.targets) {
              if ((target as any).deleted_at) {
                // Target was deleted on server
                await deleteTargetDB(target.id);
              } else {
                await saveTarget(target);
              }
            }
            
            // Save new cursor
            await saveSyncCursor('targets', result.cursor);
            
            // Reload from DB to reflect changes
            const updatedTargets = await getAllTargets();
            update(state => ({ ...state, targets: updatedTargets.filter(t => !t.deleted_at) }));
          } catch (error) {
            console.error('Failed to sync targets from server:', error);
          }
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
          state_id: targetData.state_id,
          starting_from: targetData.starting_from,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Save locally immediately
        await saveTarget(target);
        
        // Queue for sync
        await syncService.queueTargetCreate(target);
        
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
        // Get current target to merge with updates
        let currentTarget: DailyTarget | undefined;
        update(state => {
          currentTarget = state.targets.find(t => t.id === id);
          return state;
        });

        if (!currentTarget) {
          throw new Error(`Target ${id} not found`);
        }

        const updatedTarget: DailyTarget = {
          ...currentTarget,
          ...targetData,
          id,
          updated_at: new Date().toISOString(),
        };

        // Save locally immediately
        await saveTarget(updatedTarget);
        
        // Queue for sync
        await syncService.queueTargetUpdate(updatedTarget);
        
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

    async delete(id: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        // Soft delete locally
        const deletedTarget: Partial<DailyTarget> = {
          id,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        // Queue for sync
        await syncService.queueTargetDelete(id);
        
        // Remove from UI immediately
        update(state => ({ 
          ...state, 
          targets: state.targets.filter(t => t.id !== id),
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

    // Method to handle sync updates
    async applySync(targets: DailyTarget[]) {
      const activeTargets = targets.filter(t => !t.deleted_at);
      
      // Save all to local DB
      for (const target of targets) {
        if (target.deleted_at) {
          await deleteTargetDB(target.id);
        } else {
          await saveTarget(target);
        }
      }
      
      // Update UI with active targets only
      update(state => ({ ...state, targets: activeTargets }));
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
