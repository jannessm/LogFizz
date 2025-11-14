import { writable, derived } from 'svelte/store';
import type { DailyTarget } from '../types';
import { saveTarget, getAllTargets, deleteTarget as deleteTargetDB } from '../lib/db';
import { syncService } from '../services/sync';
import ky from 'ky';

function createTargetsStore() {
  const { subscribe, set, update } = writable<DailyTarget[]>([]);

  return {
    subscribe,
    
    async load() {
      try {
        const targets = await getAllTargets();
        set(targets);
        
        // Sync with server in background
        setTimeout(async () => {
          try {
            const serverTargets = await ky.get('api/targets', { credentials: 'include' }).json<DailyTarget[]>();
            if (serverTargets) {
              // Save to local DB
              for (const target of serverTargets) {
                await saveTarget(target);
              }
              set(serverTargets);
            }
          } catch (err) {
            // Offline or error, use local data
            console.log('Using local targets data');
          }
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
        duration_minutes: targetData.duration_minutes || 60,
        weekdays: targetData.weekdays || [1, 2, 3, 4, 5],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveTarget(target);
      
      if (navigator.onLine) {
        try {
          const created = await ky.post('api/targets', { json: target, credentials: 'include' }).json<DailyTarget>();
          if (created) {
            await saveTarget(created);
            update(targets => [...targets, created]);
            return created;
          }
        } catch (error) {
          console.error('Error creating target on server:', error);
        }
      }
      
      // Queue for sync if offline
      await syncService.queueTargetCreate(target);
      update(targets => [...targets, target]);
      return target;
    },

    async update(id: string, targetData: Partial<DailyTarget>) {
      const updatedTarget = {
        ...targetData,
        id,
        updated_at: new Date().toISOString(),
      } as DailyTarget;

      await saveTarget(updatedTarget);
      
      if (navigator.onLine) {
        try {
          const updated = await ky.put(`api/targets/${id}`, { json: targetData, credentials: 'include' }).json<DailyTarget>();
          if (updated) {
            await saveTarget(updated);
            update(targets => targets.map(t => t.id === id ? updated : t));
            return updated;
          }
        } catch (error) {
          console.error('Error updating target on server:', error);
        }
      }
      
      // Queue for sync if offline
      await syncService.queueTargetUpdate(id, targetData);
      update(targets => targets.map(t => t.id === id ? updatedTarget : t));
      return updatedTarget;
    },

    async delete(id: string) {
      await deleteTargetDB(id);
      
      if (navigator.onLine) {
        try {
          await ky.delete(`api/targets/${id}`, { credentials: 'include' });
        } catch (error) {
          console.error('Error deleting target on server:', error);
        }
      }
      
      // Queue for sync if offline
      await syncService.queueTargetDelete(id);
      update(targets => targets.filter(t => t.id !== id));
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
