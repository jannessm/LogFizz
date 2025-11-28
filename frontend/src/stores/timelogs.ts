import { writable, derived } from 'svelte/store';
import type { TimeLog } from '../types';
import { timeLogApi, isOnline } from '../services/api';
import { 
  getAllButtons,
  getAllTimeLogs, 
  saveTimeLog as saveTimeLogDB,
  getTimeLogsByButton,
  getSyncCursor,
  saveSyncCursor,
  deleteTimeLog as deleteTimeLogDB
} from '../lib/db';
import { syncService } from '../services/sync';
import { monthlyBalanceService } from '../services/monthly-balance.service';

interface TimeLogsStore {
  timeLogs: TimeLog[];
  activeTimers: TimeLog[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Helper function to recalculate monthly balances after timelog changes
 */
async function recalculateBalancesForTimeLogs(timeLogs: TimeLog[]): Promise<void> {
  if (timeLogs.length === 0) {
    return;
  }

  try {
    const timeLogsForRecalc = timeLogs.map(tl => ({
      start_timestamp: tl.start_timestamp,
      button_id: tl.button_id,
    }));
    await monthlyBalanceService.recalculateAffectedMonthlyBalances(timeLogsForRecalc);
  } catch (error) {
    console.error('Failed to recalculate monthly balances:', error);
  }
}

function createTimeLogsStore() {
  const { subscribe, set, update } = writable<TimeLogsStore>({
    timeLogs: [],
    activeTimers: [],
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
                return { ...state, timeLogs: updatedTimeLogs};
              });
              this.loadActive();
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
        // get all buttons
        const buttons = await getAllButtons();
        let activeTimers: TimeLog[] = [];

        for (const button of buttons) {
          const localTimeLogs = await getTimeLogsByButton(button.id);
          localTimeLogs.sort((a, b) => 
            new Date(b.start_timestamp).getTime() - new Date(a.start_timestamp).getTime()
          );
          
          // Find the most recent log that has no end_timestamp (still running)
          const activeLog = localTimeLogs.find(tl => !tl.end_timestamp);
          if (activeLog) {
            activeTimers.push(activeLog);
          }
        }

        update(state => ({ ...state, activeTimers: activeTimers }));
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
          start_timestamp: new Date().toISOString(),
          // No end_timestamp - timer is running
          timezone: 'UTC',
          apply_break_calculation: false,
          is_manual: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Offline: queue for sync
        await syncService.queueTimeLogCreate(timeLog);

        // Recalculate monthly balances
        await recalculateBalancesForTimeLogs([timeLog]);

        update(state => {
          const activeTimers = [...(state.activeTimers || []), timeLog];
          
          return ({ 
          ...state, 
          activeTimers: activeTimers,
          timeLogs: [...state.timeLogs, timeLog],
          isLoading: false 
        })});
        return timeLog;
      
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
        // Find the running timer and update it with end_timestamp
        const allTimeLogs = await getAllTimeLogs();
        const runningTimer = allTimeLogs.find(tl => tl.id === id);
        if (!runningTimer) throw new Error('Timer not found');
        
        const now = new Date();
        const start = new Date(runningTimer.start_timestamp);
        const durationMinutes = Math.round((now.getTime() - start.getTime()) / (1000 * 60));
        
        // Update the timer with end timestamp and duration
        const updatedTimeLog: TimeLog = {
          ...runningTimer,
          end_timestamp: now.toISOString(),
          duration_minutes: durationMinutes,
          updated_at: now.toISOString(),
        };
        
        await syncService.queueTimeLogUpdate(updatedTimeLog);
        
        // Recalculate monthly balances
        await recalculateBalancesForTimeLogs([updatedTimeLog]);
        
        update(state => ({
          ...state,
          activeTimers: state.activeTimers.filter(t => t.id !== id),
          timeLogs: state.timeLogs.map(tl => tl.id === id ? updatedTimeLog : tl),
          isLoading: false
        }));
        return updatedTimeLog;
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },

    async create(buttonId: string, startTimestamp: string, endTimestamp?: string) {
      return this.createManual({
        button_id: buttonId,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp,
      });
    },

    async createManual(timeLogData: Partial<TimeLog>) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        // Calculate duration if end_timestamp is provided
        let durationMinutes: number | undefined;
        if (timeLogData.start_timestamp && timeLogData.end_timestamp) {
          const start = new Date(timeLogData.start_timestamp);
          const end = new Date(timeLogData.end_timestamp);
          durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
        }
        
        const timeLog: TimeLog = {
          id: crypto.randomUUID(),
          user_id: timeLogData.user_id || '',
          button_id: timeLogData.button_id || '',
          start_timestamp: timeLogData.start_timestamp || new Date().toISOString(),
          end_timestamp: timeLogData.end_timestamp,
          duration_minutes: durationMinutes,
          timezone: timeLogData.timezone || 'UTC',
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
            // Recalculate monthly balances
            await recalculateBalancesForTimeLogs([created]);
            update(state => ({ 
              ...state, 
              timeLogs: [...state.timeLogs, created],
              isLoading: false 
            }));
            return created;
          } catch (error) {
            await syncService.queueTimeLogCreate(timeLog);
            // Recalculate monthly balances
            await recalculateBalancesForTimeLogs([timeLog]);
            update(state => ({ 
              ...state, 
              timeLogs: [...state.timeLogs, timeLog],
              isLoading: false 
            }));
            return timeLog;
          }
        } else {
          await syncService.queueTimeLogCreate(timeLog);
          // Recalculate monthly balances
          await recalculateBalancesForTimeLogs([timeLog]);
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
        // Get the timelog before deleting to recalculate balances
        const timeLog = await getAllTimeLogs().then(logs => logs.find(tl => tl.id === id));
        
        // Delete from local DB first
        await deleteTimeLogDB(id);
        
        // Queue delete for sync
        await syncService.queueTimeLogDelete(id);

        // Recalculate monthly balances if timelog was found
        if (timeLog) {
          await recalculateBalancesForTimeLogs([timeLog]);
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
      tl.start_timestamp && tl.start_timestamp.startsWith(today)
    );
  }
);
