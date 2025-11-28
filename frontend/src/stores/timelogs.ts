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
      timestamp: tl.timestamp,
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
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          
          // filter last start events per button
          const recentStart = localTimeLogs.filter(tl => tl.type === 'start')[0];
          // filter last stop events per button
          const recentStop = localTimeLogs.filter(tl => tl.type === 'stop')[0];
          
          // Check if there's a corresponding start event and no stop event after it
          const startAfterStop = recentStop && recentStart && new Date(recentStop.timestamp).getTime() < new Date(recentStart.timestamp).getTime() || false;

          if (startAfterStop) {
            activeTimers.push(recentStart);
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
          type: 'start',
          timestamp: new Date().toISOString(),
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
        // create stop event locally and queue for sync
        const startEvent = await getAllTimeLogs().then(logs => logs.find(tl => tl.id === id));
        if (!startEvent) throw new Error('Start event not found');
        
        const stopEvent: TimeLog = {
          id: crypto.randomUUID(),
          user_id: startEvent.user_id,
          button_id: startEvent.button_id,
          type: 'stop',
          timestamp: new Date().toISOString(),
          timezone: startEvent.timezone || 'UTC',
          apply_break_calculation: startEvent.apply_break_calculation,
          is_manual: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        await syncService.queueTimeLogCreate(stopEvent);
        
        // Recalculate monthly balances
        await recalculateBalancesForTimeLogs([startEvent, stopEvent]);
        
        update(state => ({
          ...state,
          activeTimers: state.activeTimers.filter(t => t.id !== id),
          timeLogs: [...state.timeLogs, stopEvent],
          isLoading: false
        }));
        return stopEvent;
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
      tl.timestamp && tl.timestamp.startsWith(today)
    );
  }
);
