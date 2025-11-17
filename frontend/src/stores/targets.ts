import { writable, derived } from 'svelte/store';
import type { DailyTarget } from '../types';
import { saveTarget, getAllTargets, deleteTarget as deleteTargetDB } from '../lib/db';
import { syncService } from '../services/sync';

function createTargetsStore() {
  const { subscribe, set, update } = writable<DailyTarget[]>([]);

  return {
    subscribe,
    
    async load() {
      try {
        const targets = await getAllTargets();
        set(targets.filter(t => !t.deleted_at)); // Filter out soft-deleted targets
        
        // Trigger background sync
        setTimeout(() => {
          syncService.sync();
        }, 100);
      } catch (error) {
        console.error('Error loading targets:', error);
        set([]);
      }
    },

    async create(targetData: Partial<DailyTarget>) {
      const target: DailyTarget = {
        id: crypto.randomUUID(),
        user_id: '',
        name: targetData.name || '',
        duration_minutes: targetData.duration_minutes || [60], // Default to 60 minutes
        weekdays: targetData.weekdays || [1, 2, 3, 4, 5], // Default to weekdays
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save locally immediately
      await saveTarget(target);
      
      // Queue for sync
      await syncService.queueTargetCreate(target);
      
      // Update UI
      update(targets => [...targets, target]);
      
      return target;
    },

    async update(id: string, targetData: Partial<DailyTarget>) {
      // Get current target to merge with updates
      let currentTarget: DailyTarget | undefined;
      update(targets => {
        currentTarget = targets.find(t => t.id === id);
        return targets;
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
      update(targets => targets.map(t => t.id === id ? updatedTarget : t));
      
      return updatedTarget;
    },

    async delete(id: string) {
      // Soft delete locally
      const deletedTarget: Partial<DailyTarget> = {
        id,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Queue for sync
      await syncService.queueTargetDelete(id);
      
      // Remove from UI immediately
      update(targets => targets.filter(t => t.id !== id));
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
      set(activeTargets);
    },
  };
}

export const targetsStore = createTargetsStore();

// Derived store for today's targets
export const todayTargets = derived(
  targetsStore,
  ($targets) => {
    const today = new Date().getDay();
    return $targets.filter(t => t.weekdays.includes(today));
  }
);
