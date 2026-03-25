import { derived } from 'svelte/store';
import type { TimeLog, Timer } from '../types';
import { 
  getTimeLogsByYearMonth,
  saveTimeLog as saveTimeLogDB,
  deleteTimeLog as deleteTimeLogDB,
} from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig, mapToArray, arrayToMap } from './base-store';
import { dayjs, userTimezone } from '../../../lib/utils/dayjs.js';
import { recalculateBalancesForTimeLog } from '../utils/balance-recalculation';
/**
 * Check if a timelog started before the given timestamp
 */
function timelogStartedBefore(timelog: TimeLog, timestamp: string): boolean {
  return new Date(timelog.start_timestamp).getTime() < new Date(timestamp).getTime();
}

/**
 * Check if a timelog ended after the given timestamp
 * Returns true if timelog is still running (no end_timestamp) and timestamp is undefined
 */
function timelogEndedAfter(timelog: TimeLog, timestamp?: string): boolean {
  if (!timestamp) {
    return timelog.end_timestamp === undefined;
  } else if (!timelog.end_timestamp) {
    return false;
  } else {
    return new Date(timelog.end_timestamp).getTime() > new Date(timestamp).getTime();
  }
}

/**
 * Configuration for the timelogs store
 * Timelogs represent time tracking entries with start/end timestamps
 * Includes hooks for balance recalculation on CRUD operations
 */
// Captured previous timelog state for balance recalculation on update.
// Set in beforeUpdate, consumed in afterUpdate.
let previousTimelogForRecalc: TimeLog | undefined;

const timeLogStoreConfig: BaseStoreConfig<TimeLog> = {
  db: {
    getAll: () => getTimeLogsByYearMonth(
      dayjs.utc().tz(userTimezone).year(),
      dayjs.utc().tz(userTimezone).month() + 1
    ), // Only load current month initially for performance
    save: saveTimeLogDB,
    delete: deleteTimeLogDB,
  },
  sync: {
    queueUpsert: syncService.queueUpsertTimeLog.bind(syncService),
    queueDelete: syncService.queueDeleteTimeLog.bind(syncService),
    syncType: 'timelog',
  },
  hooks: {
    afterCreate: async (timeLog) => {
      await recalculateBalancesForTimeLog(timeLog);
    },
    beforeUpdate: async (timeLog, state) => {
      // Capture the old version so afterUpdate can recalculate the union of old+new ranges
      const oldTimelog = state.items.get(timeLog.id);
      previousTimelogForRecalc = oldTimelog ? { ...oldTimelog } : undefined;

      // sort all timelogs by start_timestamp
      const allTimeLogs = mapToArray(state.items).filter(tl => tl.id !== timeLog.id)
        .sort((a, b) =>
          new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime()
        );

      // get timelog that starts before the updated timelog and ends after
      const warppingTimelog = allTimeLogs.find(tl => 
        timelogStartedBefore(tl, timeLog.start_timestamp) && 
        timelogEndedAfter(tl, timeLog.end_timestamp)
      );

      if (warppingTimelog) {
        throw new Error('The updated time log overlaps with an existing time log.');
      }

      return timeLog;
    },
    afterUpdate: async (timeLog) => {
      await recalculateBalancesForTimeLog(timeLog, undefined, previousTimelogForRecalc);
      previousTimelogForRecalc = undefined;
    },
    afterDelete: async (timeLog) => {
      await recalculateBalancesForTimeLog(timeLog);
    },
  },
  storeName: 'timelogs',
};

const baseStore = createBaseStore<TimeLog>(timeLogStoreConfig);

/**
 * Creates the timelogs store with time tracking operations
 * @returns Enhanced timelog store with timer start/stop and CRUD operations
 */
function createTimeLogsStore() {
  // Track which year-month combinations have been loaded
  const loadedMonths = new Set<string>();
  // initialize with current month as loaded by store (month() + 1 because dayjs months are 0-indexed)
  loadedMonths.add(`${dayjs.utc().tz(userTimezone).year()}-${dayjs.utc().tz(userTimezone).month() + 1}`);

  /**
   * Reload all previously loaded months (used after sync)
   */
  async function reloadAllLoadedMonths(): Promise<void> {
    const months = Array.from(loadedMonths);
    const allTimeLogs: TimeLog[] = [];
    
    for (const monthKey of months) {
      const [yearStr, monthStr] = monthKey.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      
      const logs = (await getTimeLogsByYearMonth(year, month)).filter(tl => !tl.deleted_at);
      allTimeLogs.push(...logs);
    }
    
    // Update the store with all loaded timelogs
    baseStore.updateWriteable(state => ({
      ...state,
      items: arrayToMap(allTimeLogs),
      isLoading: false
    }));
  }

  return {
    ...baseStore,

    /**
     * Get the set of loaded month keys for external access
     */
    getLoadedMonths(): Set<string> {
      return new Set(loadedMonths);
    },

    /**
     * Reload all previously loaded months (used after sync)
     */
    reloadAllLoadedMonths,

    /**
     * Override load to register custom afterSync callback
     */
    async load(sync: boolean = true) {
      baseStore.updateWriteable(state => ({ ...state, isLoading: true, error: null }));

      // Register custom afterSync callback that reloads all loaded months
      if (!baseStore.syncCallbackRegistered) {
        syncService.afterSync(timeLogStoreConfig.sync.syncType, async () => {
          await reloadAllLoadedMonths();
        });
        baseStore.syncCallbackRegistered = true;
      }

      try {
        // Load current month from local DB
        const currentYear = dayjs.utc().tz(userTimezone).year();
        const currentMonth = dayjs.utc().tz(userTimezone).month() + 1;
        const items = (await getTimeLogsByYearMonth(currentYear, currentMonth)).filter(tl => !tl.deleted_at);

        baseStore.updateWriteable(state => ({ ...state, items: arrayToMap(items), isLoading: false }));

        // Sync with server if requested
        if (sync) {
          await syncService.sync('timelog');
        }
      } catch (error) {
        baseStore.updateWriteable(state => ({ 
          ...state, 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }));
        throw error;
      }
    },

    /**
     * Create a new timelog entry
     * @param timeLogData - Partial timelog data
     * @returns Created timelog
     */
    async create(timeLogData: Partial<TimeLog>) {
      return baseStore.create({
        id: crypto.randomUUID(),
        user_id: timeLogData.user_id || '',
        timer_id: timeLogData.timer_id || '',
        type: timeLogData.type || 'normal',
        whole_day: timeLogData.whole_day ?? false,
        start_timestamp: timeLogData.start_timestamp || dayjs().toISOString(),
        end_timestamp: timeLogData.end_timestamp,
        duration_minutes: undefined, // Let saveTimeLog calculate this
        timezone: timeLogData.timezone || userTimezone,
        apply_break_calculation: timeLogData.apply_break_calculation ?? false,
        notes: timeLogData.notes || '',
        created_at: dayjs.utc().toISOString(),
        updated_at: dayjs.utc().toISOString(),
        year: (dayjs.utc(timeLogData.start_timestamp || dayjs.utc()).tz(timeLogData.timezone || userTimezone).year()),
        month: (dayjs.utc(timeLogData.start_timestamp || dayjs.utc()).tz(timeLogData.timezone || userTimezone).month() + 1),
      });
    },

    /**
     * Load timelogs for a specific year and month
     * @param year - Year to load (e.g., 2024)
     * @param month - Month to load (1-12, same as dayjs.month() + 1)
     * @returns Array of timelogs for that month
     */
    async loadLogsByYearMonth(year: number, month: number): Promise<TimeLog[]> {
      const key = `${year}-${month}`;
      
      // Skip if already loaded
      if (loadedMonths.has(key)) {
        const existingLogs = mapToArray(baseStore.getState().items).filter((tl: TimeLog) => {
          // Use year/month properties if available, otherwise parse from start_timestamp
          const logTz = tl.timezone || userTimezone;
          const logYear = tl.year ?? dayjs.utc(tl.start_timestamp).tz(logTz).year();
          const logMonth = tl.month ?? (dayjs.utc(tl.start_timestamp).tz(logTz).month() + 1);
          return logYear === year && logMonth === month;
        });
        return existingLogs;
      }

      baseStore.updateWriteable(state => ({ ...state, isLoading: true, error: null }));
      try {
        const timeLogs = await getTimeLogsByYearMonth(year, month); // month is already 1-12
        loadedMonths.add(key);
        baseStore.updateWriteable(state => {
          const newItems = new Map(state.items);
          for (const log of timeLogs) {
            if (log.deleted_at) {
              newItems.delete(log.id);
            } else {
              newItems.set(log.id, log);
            }
          }
          return {
            ...state,
            items: newItems,
            isLoading: false
          };
        });
        // Filter out deleted items before returning
        return timeLogs.filter(tl => !tl.deleted_at);
      } catch (error: any) {
        baseStore.updateWriteable(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },


    /**
     * Start a new timer (create running timelog)
     * @param timerId - ID of the timer to start
     * @returns Created timelog with no end_timestamp
     */
    async startTimer(timer: Timer) {
      const timeLog = await baseStore.create({
        id: crypto.randomUUID(),
        user_id: '', // Will be set by backend
        timer_id: timer.id,
        type: 'normal',
        whole_day: false,
        start_timestamp: dayjs().toISOString(),
        timezone: userTimezone,
        apply_break_calculation: timer.auto_subtract_breaks || false,
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString(),
      });

      return timeLog;
    },

    /**
     * Stop a running timer by setting end_timestamp
     * @param timelog - The running timelog to stop
     * @param notes - Optional notes to add
     * @param endTimestamp - Optional custom end time (defaults to now)
     * @returns Updated timelog with end_timestamp
     */
    async stopTimer(timelog: TimeLog, notes?: string, endTimestamp?: string) {
      const now = dayjs();
      const endTime = endTimestamp || now.toISOString();
      
      const updatedTimeLog = await baseStore.update(timelog.id, {
        end_timestamp: endTime,
        duration_minutes: undefined, // Let saveTimeLog calculate this
        ...(notes !== undefined && { notes }),
      });

      return updatedTimeLog;
    },
  };
}

/** Main timelogs store - manages time tracking entries */
export const timeLogsStore = createTimeLogsStore();

export const timerlogs = derived(
  timeLogsStore,
  $timeLogsStore => mapToArray($timeLogsStore.items)
);

/** Derived store for active timelogs (running timers - no end_timestamp) */
export const activeTimeLogs = derived(
  timeLogsStore,
  $timeLogsStore => {
    return mapToArray($timeLogsStore.items).filter(tl => !tl.end_timestamp);
  }
);

/**
 * Create a derived store that provides timelogs for a specific month range
 * Useful for calendar views that need to show timelogs across multiple months
 * @param year - Year to filter
 * @param month - Month to filter (1-12)
 * @param range - Number of months before and after to include (default 1)
 */
export function getTimeLogsForMonthRange(year: number, month: number, range: number = 1) {
  return derived(
    timeLogsStore,
    $timeLogsStore => {
      const logs: TimeLog[] = [];
      for (let i = -range; i <= range; i++) {
        // Use the 1st of the month to avoid day-of-month overflow issues
        const targetDate = dayjs.utc().year(year).month(month - 1).date(1).add(i, 'month');
        const targetYear = targetDate.year();
        const targetMonth = targetDate.month() + 1;
        
        const monthLogs = mapToArray($timeLogsStore.items).filter((tl: TimeLog) => {
          const logYear = tl.year ?? dayjs.utc(tl.start_timestamp).tz(userTimezone).year();
          const logMonth = tl.month ?? (dayjs.utc(tl.start_timestamp).tz(userTimezone).month() + 1);
          return logYear === targetYear && logMonth === targetMonth;
        });
        logs.push(...monthLogs);
      }
      return logs;
    }
  );
}

/**
 * Create a derived store that provides timelogs for a specific date
 * @param date - Date string in YYYY-MM-DD format
 */
export function getTimeLogsForDate(date: string) {
  return derived(
    timeLogsStore,
    $timeLogsStore => {
      return mapToArray($timeLogsStore.items).filter(tl => {
        if (!tl.start_timestamp) return false;
        const logTimezone = tl.timezone || userTimezone;
        const logDate = dayjs.utc(tl.start_timestamp).tz(logTimezone);
        return logDate.format('YYYY-MM-DD') === date;
      });
    }
  );
}
