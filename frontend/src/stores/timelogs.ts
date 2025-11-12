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
        // Load from local DB first (fast - show data immediately)
        const localTimeLogs = await getAllTimeLogs();
        update(state => ({ ...state, timeLogs: localTimeLogs, isLoading: false }));

        // Try to pull incremental changes from server in background (don't block UI)
        if (isOnline()) {
          // Don't await - do this in the background
          (async () => {
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
              update(state => {
                // Clear active timer if it has a corresponding stop event in synced data
                let clearedActiveTimer = state.activeTimer;
                if (clearedActiveTimer && clearedActiveTimer.type === 'start') {
                  // Check if there's a stop event for this timer
                  const hasStopEvent = updatedTimeLogs.some(tl => 
                    tl.button_id === clearedActiveTimer!.button_id && 
                    tl.type === 'stop' &&
                    new Date(tl.timestamp).getTime() > new Date(clearedActiveTimer!.timestamp).getTime()
                  );
                  if (hasStopEvent) {
                    // Timer was stopped on server, clear it locally
                    clearedActiveTimer = null;
                  }
                }
                return { ...state, timeLogs: updatedTimeLogs, activeTimer: clearedActiveTimer };
              });
            } catch (error) {
              console.error('Failed to sync timelogs from server:', error);
            }
          })();
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
          try {
            const active = await timeLogApi.getActive();
            update(state => ({ ...state, activeTimer: active }));
            if (active) {
              await saveTimeLogDB(active);
            }
          } catch (error) {
            console.error('Failed to fetch active timer from server:', error);
            // If server fetch fails, don't try to guess from local DB
            // Better to show no active timer than to show a wrong one
            update(state => ({ ...state, activeTimer: null }));
          }
        } else {
          // When offline, be very conservative about showing active timers
          // Only consider start events from the last hour without matching stop events
          const localTimeLogs = await getAllTimeLogs();
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          
          // Find all start events in the last hour
          const recentStarts = localTimeLogs.filter(tl => {
            if (tl.type !== 'start') return false;
            if (!tl.timestamp) return false;
            const timestamp = new Date(tl.timestamp).getTime();
            return timestamp > oneHourAgo;
          });
          
          // Find the most recent start without a matching stop
          let active: TimeLog | null = null;
          for (const start of recentStarts.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )) {
            // Check if there's a stop event after this start
            const hasStop = localTimeLogs.some(tl =>
              tl.type === 'stop' &&
              tl.button_id === start.button_id &&
              new Date(tl.timestamp).getTime() > new Date(start.timestamp).getTime()
            );
            if (!hasStop) {
              active = start;
              break;
            }
          }
          
          update(state => ({ ...state, activeTimer: active }));
        }
      } catch (error) {
        console.error('Failed to load active timer:', error);
        // On error, clear active timer to be safe
        update(state => ({ ...state, activeTimer: null }));
      }
    },

    async startTimer(buttonId: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const timeLog: TimeLog = {
          id: crypto.randomUUID(),
          user_id: '', // Will be set by backend
          button_id: buttonId,
          type: 'start',
          timestamp: new Date().toISOString(),
          apply_break_calculation: false,
          is_manual: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
        if (isOnline()) {
          try {
            // Backend will create a new stop event
            const stopped = await timeLogApi.stop(id);
            await saveTimeLogDB(stopped);
            update(state => {
              // Add the stop event to timeLogs
              return {
                ...state,
                activeTimer: null,
                timeLogs: [...state.timeLogs, stopped],
                isLoading: false
              };
            });
            return stopped;
          } catch (error) {
            // If API fails, create stop event locally and queue for sync
            const startEvent = await getAllTimeLogs().then(logs => logs.find(tl => tl.id === id));
            if (!startEvent) throw new Error('Start event not found');
            
            const stopEvent: TimeLog = {
              id: crypto.randomUUID(),
              user_id: startEvent.user_id,
              button_id: startEvent.button_id,
              type: 'stop',
              timestamp: new Date().toISOString(),
              apply_break_calculation: startEvent.apply_break_calculation,
              is_manual: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            
            await syncService.queueTimeLogCreate(stopEvent);
            
            update(state => ({
              ...state,
              activeTimer: null,
              timeLogs: [...state.timeLogs, stopEvent],
              isLoading: false
            }));
            return stopEvent;
          }
        } else {
          // Offline: create stop event locally and queue for sync
          const startEvent = await getAllTimeLogs().then(logs => logs.find(tl => tl.id === id));
          if (!startEvent) throw new Error('Start event not found');
          
          const stopEvent: TimeLog = {
            id: crypto.randomUUID(),
            user_id: startEvent.user_id,
            button_id: startEvent.button_id,
            type: 'stop',
            timestamp: new Date().toISOString(),
            apply_break_calculation: startEvent.apply_break_calculation,
            is_manual: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          await syncService.queueTimeLogCreate(stopEvent);
          
          update(state => ({
            ...state,
            activeTimer: null,
            timeLogs: [...state.timeLogs, stopEvent],
            isLoading: false
          }));
          return stopEvent;
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

    async create(buttonId: string, timestamp: string, type: 'start' | 'stop') {
      return this.createManual({
        button_id: buttonId,
        timestamp,
        type,
      });
    },

    async createManual(timeLogData: Partial<TimeLog>) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const timeLog: TimeLog = {
          id: crypto.randomUUID(),
          user_id: timeLogData.user_id || '',
          button_id: timeLogData.button_id || '',
          type: timeLogData.type || 'start',
          timestamp: timeLogData.timestamp || new Date().toISOString(),
          apply_break_calculation: timeLogData.apply_break_calculation ?? false,
          notes: timeLogData.notes,
          is_manual: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
        // Delete from local DB first
        await deleteTimeLogDB(id);
        
        // Try to delete from server if online
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
      tl.timestamp && tl.timestamp.startsWith(today)
    );
  }
);
