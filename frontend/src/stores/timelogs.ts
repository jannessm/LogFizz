import { derived, get } from 'svelte/store';
import type { TimeLog } from '../types';
import { 
  getTimeLogsByYearMonth,
  saveTimeLog as saveTimeLogDB,
  deleteTimeLog as deleteTimeLogDB,
} from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig } from './base-store';
import { dayjs, userTimezone } from '../../../lib/utils/dayjs.js';
import { balancesStore } from './balances';
import { targetsStore } from './targets';

/**
 * Triggers balance recalculation for timelogs.
 * Identifies all affected dates (handling multi-day timelogs) and triggers
 * daily balance recalculation which propagates up through monthly and yearly balances.
 * 
 * Algorithm from docs/balances.md:
 * 1. For each granularity level (daily, monthly, yearly):
 *    - Get balances directly affected by the timelog
 *    - Recalculate each daily balance completely
 *    - For monthly/yearly: propagate cumulations through next_balance_id chain
 * 
 * @param timelog - Timelog that was created/updated/deleted
 */
async function recalculateBalancesForTimeLog(timelog: TimeLog) {
  await Promise.all([
    targetsStore.load(),
    balancesStore.load()
  ]);
  
  const targets = await targetsStore.getTargetsByTimerIds([timelog.timer_id]);
  if (targets.length === 0) return;
  
  const start = dayjs(timelog.start_timestamp);
  const end = timelog.end_timestamp ? dayjs(timelog.end_timestamp) : dayjs();
  
  // Get all affected dates (timelog may span multiple days)
  const affectedDates: string[] = [];
  let current = start.startOf('day');
  const endDay = end.startOf('day');
  
  while (current.isSameOrBefore(endDay, 'day')) {
    affectedDates.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }
  
  // Get unique months and years from affected dates
  const affectedMonths = new Set(affectedDates.map(d => d.substring(0, 7))); // YYYY-MM
  const affectedYears = new Set(affectedDates.map(d => d.substring(0, 4))); // YYYY
  
  for (const target of targets) {
    // 1. Recalculate daily balances
    for (const date of affectedDates) {
      await balancesStore.recalculateDailyBalance(target.id, date);
    }
    
    // 2. Recalculate monthly balances and propagate cumulations
    for (const month of affectedMonths) {
      const [year, monthNum] = month.split('-').map(Number);
      await balancesStore.recalculateMonthlyBalance(target.id, year, monthNum);
    }
    
    // 3. Recalculate yearly balances and propagate cumulations
    for (const year of affectedYears) {
      await balancesStore.recalculateYearlyBalance(target.id, Number(year));
    }
  }
}

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
const timeLogStoreConfig: BaseStoreConfig<TimeLog> = {
  db: {
    getAll: () => getTimeLogsByYearMonth(
      dayjs().tz(userTimezone).year(),
      dayjs().tz(userTimezone).month() + 1
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
      // sort all timelogs by start_timestamp
      const allTimeLogs = state.items.filter(tl => tl.id !== timeLog.id)
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
      await recalculateBalancesForTimeLog(timeLog);
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
  return {
    ...baseStore,

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
        start_timestamp: timeLogData.start_timestamp || new Date().toISOString(),
        end_timestamp: timeLogData.end_timestamp,
        duration_minutes: undefined, // Let saveTimeLog calculate this
        timezone: timeLogData.timezone || userTimezone,
        apply_break_calculation: timeLogData.apply_break_calculation ?? false,
        notes: timeLogData.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },

    /**
     * Load timelogs for a specific year and month
     * @param year - Year to load (e.g., 2024)
     * @param month - Month to load (1-12)
     * @returns Array of timelogs for that month
     */
    async loadLogsByYearMonth(year: number, month: number): Promise<TimeLog[]> {
      baseStore.updateWriteable(state => ({ ...state, isLoading: true, error: null }));
      try {
        const timeLogs = await getTimeLogsByYearMonth(year, month);
        baseStore.updateWriteable(state => ({
          ...state,
          items: [...timeLogs, ...state.items],
          isLoading: false
        }));
        return timeLogs;
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
    async startTimer(timerId: string) {
      const timeLog = await baseStore.create({
        id: crypto.randomUUID(),
        user_id: '', // Will be set by backend
        timer_id: timerId,
        type: 'normal',
        whole_day: false,
        start_timestamp: new Date().toISOString(),
        timezone: userTimezone,
        apply_break_calculation: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
      const now = new Date();
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

export const timers = derived(
  timeLogsStore,
  $timeLogsStore => $timeLogsStore.items
);

/** Derived store for today's timelogs */
export const todayTimeLogs = derived(
  timeLogsStore,
  $timeLogsStore => {
    const today = new Date().toISOString().split('T')[0];
    return $timeLogsStore.items.filter(tl => 
      tl.start_timestamp && tl.start_timestamp.startsWith(today)
    );
  }
);

/** Derived store for active timelogs (running timers - no end_timestamp) */
export const activeTimeLogs = derived(
  timeLogsStore,
  $timeLogsStore => {
    return $timeLogsStore.items.filter(tl => !tl.end_timestamp);
  }
);
