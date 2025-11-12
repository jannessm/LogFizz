import { writable, derived } from 'svelte/store';
import type { TimeLog } from '../types';
import { timeLogApi, isOnline } from '../services/api';
import { 
  getAllTimeLogs, 
  saveTimeLog as saveTimeLogDB,
  getTimeLogsByButton,
  getSyncCursor,
  saveSyncCursor,
  deleteTimeLog as deleteTimeLogDB
} from '../lib/db';
import { syncService } from '../services/sync';

interface TimeLogsStore {
  timeLogs: TimeLog[];
  activeTimer: TimeLog | null;
  isLoading: boolean;
  error: string | null;
}

function createTimeLogsStore() {
  const { subscribe, set, update } = writable<TimeLogsStore>({
    timeLogs: [],
    activeTimer: null,
    isLoading: false,
    error: null,
  });

  return {
    subscribe,

    async load() {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        // Load from local DB first
        const localTimeLogs = await getAllTimeLogs();
        update(state => ({ ...state, timeLogs: localTimeLogs, isLoading: false }));

        // Try to pull incremental changes from server if online
        if (isOnline()) {
          try {
            // Get last sync cursor
            let cursor = await getSyncCursor('timelogs');
            if (!cursor) {
              // First sync - use epoch time to get all data
              cursor = new Date(0).toISOString();
            }
            
            const result = await timeLogApi.getSyncChanges(cursor);
            
            // Apply changes to local DB
            for (const timeLog of result.timeLogs) {
              if ((timeLog as any).deleted_at) {
                // TimeLog was deleted on server
                await deleteTimeLogDB(timeLog.id);
              } else {
                await saveTimeLogDB(timeLog);
              }
            }
            
            // Save new cursor
            await saveSyncCursor('timelogs', result.cursor);
            
            // Reload from DB to reflect changes
            const updatedTimeLogs = await getAllTimeLogs();
            update(state => ({ ...state, timeLogs: updatedTimeLogs }));
          } catch (error) {
            console.error('Failed to sync timelogs from server:', error);
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

    async loadActive() {
      try {
        if (isOnline()) {
          const active = await timeLogApi.getActive();
          update(state => ({ ...state, activeTimer: active }));
          if (active) {
            await saveTimeLogDB(active);
          }
        } else {
          // Find active timer in local DB
          const localTimeLogs = await getAllTimeLogs();
          const active = localTimeLogs.find(tl => !tl.end_time);
          update(state => ({ ...state, activeTimer: active || null }));
        }
      } catch (error) {
        console.error('Failed to load active timer:', error);
      }
    },

    async startTimer(buttonId: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const timeLog: TimeLog = {
          id: crypto.randomUUID(),
          user_id: '', // Will be set by backend
          button_id: buttonId,
          start_time: new Date().toISOString(),
          is_manual: false,
        };

        if (isOnline()) {
          try {
            const created = await timeLogApi.start(buttonId);
            await saveTimeLogDB(created);
            update(state => ({ 
              ...state, 
              activeTimer: created,
              timeLogs: [...state.timeLogs, created],
              isLoading: false 
            }));
            return created;
          } catch (error) {
            // If API fails, queue for sync
            await syncService.queueTimeLogCreate(timeLog);
            update(state => ({ 
              ...state, 
              activeTimer: timeLog,
              timeLogs: [...state.timeLogs, timeLog],
              isLoading: false 
            }));
            return timeLog;
          }
        } else {
          // Offline: queue for sync
          await syncService.queueTimeLogCreate(timeLog);
          update(state => ({ 
            ...state, 
            activeTimer: timeLog,
            timeLogs: [...state.timeLogs, timeLog],
            isLoading: false 
          }));
          return timeLog;
        }
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },

    async stopTimer(id: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const endTime = new Date().toISOString();
        
        if (isOnline()) {
          try {
            const stopped = await timeLogApi.stop(id);
            await saveTimeLogDB(stopped);
            update(state => {
              const index = state.timeLogs.findIndex(tl => tl.id === id);
              const newTimeLogs = [...state.timeLogs];
              if (index !== -1) {
                newTimeLogs[index] = stopped;
              }
              return {
                ...state,
                activeTimer: null,
                timeLogs: newTimeLogs,
                isLoading: false
              };
            });
            return stopped;
          } catch (error) {
            // If API fails, update locally and queue for sync
            update(state => {
              const index = state.timeLogs.findIndex(tl => tl.id === id);
              if (index === -1) throw new Error('TimeLog not found');
              
              const updatedTimeLog = { ...state.timeLogs[index], end_time: endTime };
              syncService.queueTimeLogUpdate(updatedTimeLog);
              
              const newTimeLogs = [...state.timeLogs];
              newTimeLogs[index] = updatedTimeLog;
              
              return {
                ...state,
                activeTimer: null,
                timeLogs: newTimeLogs,
                isLoading: false
              };
            });
            return null;
          }
        } else {
          // Offline: update locally and queue for sync
          update(state => {
            const index = state.timeLogs.findIndex(tl => tl.id === id);
            if (index === -1) throw new Error('TimeLog not found');
            
            const updatedTimeLog = { ...state.timeLogs[index], end_time: endTime };
            syncService.queueTimeLogUpdate(updatedTimeLog);
            
            const newTimeLogs = [...state.timeLogs];
            newTimeLogs[index] = updatedTimeLog;
            
            return {
              ...state,
              activeTimer: null,
              timeLogs: newTimeLogs,
              isLoading: false
            };
          });
          return null;
        }
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },

    async createManual(timeLogData: Partial<TimeLog>) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const timeLog: TimeLog = {
          id: crypto.randomUUID(),
          user_id: '',
          button_id: timeLogData.button_id || '',
          start_time: timeLogData.start_time || new Date().toISOString(),
          end_time: timeLogData.end_time,
          notes: timeLogData.notes,
          is_manual: true,
        };

        if (isOnline()) {
          try {
            const created = await timeLogApi.createManual(timeLog);
            await saveTimeLogDB(created);
            update(state => ({ 
              ...state, 
              timeLogs: [...state.timeLogs, created],
              isLoading: false 
            }));
            return created;
          } catch (error) {
            await syncService.queueTimeLogCreate(timeLog);
            update(state => ({ 
              ...state, 
              timeLogs: [...state.timeLogs, timeLog],
              isLoading: false 
            }));
            return timeLog;
          }
        } else {
          await syncService.queueTimeLogCreate(timeLog);
          update(state => ({ 
            ...state, 
            timeLogs: [...state.timeLogs, timeLog],
            isLoading: false 
          }));
          return timeLog;
        }
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
        if (isOnline()) {
          try {
            await timeLogApi.delete(id);
          } catch (error) {
            await syncService.queueTimeLogDelete(id);
          }
        } else {
          await syncService.queueTimeLogDelete(id);
        }

        update(state => ({
          ...state,
          timeLogs: state.timeLogs.filter(tl => tl.id !== id),
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

export const timeLogsStore = createTimeLogsStore();

// Derived store for today's timelogs
export const todayTimeLogs = derived(
  timeLogsStore,
  $timeLogsStore => {
    const today = new Date().toISOString().split('T')[0];
    return $timeLogsStore.timeLogs.filter(tl => 
      tl.start_time.startsWith(today)
    );
  }
);
