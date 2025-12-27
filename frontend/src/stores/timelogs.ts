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

async function recalculateBalancesForTimeLogs(timelogs: TimeLog[]) {
  // get months affected by the timelogs
  const affectedMonths = new Set<string>();
  for (const tl of timelogs) {
    const start = dayjs.tz(tl.start_timestamp, userTimezone);
    affectedMonths.add(`${start.year()}-${start.month() + 1}`);
    if (tl.end_timestamp) {
      const end = dayjs.tz(tl.end_timestamp, userTimezone);
      affectedMonths.add(`${end.year()}-${end.month() + 1}`);
    }
  }

  // Trigger balance recalculation for affected months
  for (const monthKey of affectedMonths) {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    // Balance recalculation will be handled by the balances store
    // For now, just log the affected months
    // TODO: trigger calculation!
    console.log(`Balance recalculation needed for ${year}-${month}`);
  }
}

function timelogStartedBefore(timelog: TimeLog, timestamp: string): boolean {
  return new Date(timelog.start_timestamp).getTime() < new Date(timestamp).getTime();
}
function timelogEndedAfter(timelog: TimeLog, timestamp?: string): boolean {
  if (!timestamp) {
    return timelog.end_timestamp === undefined;
  } else if (!timelog.end_timestamp) {
    return false;
  } else {
    return new Date(timelog.end_timestamp).getTime() > new Date(timestamp).getTime();
  }
}



// Configure the base store for timelogs with hooks for monthly balance recalculation
const timeLogStoreConfig: BaseStoreConfig<TimeLog> = {
  db: {
    getAll: () => getTimeLogsByYearMonth(
      dayjs().tz(userTimezone).year(),
      dayjs().tz(userTimezone).month() + 1
    ), // only load current month initially for performance
    save: saveTimeLogDB,
    delete: deleteTimeLogDB,
  },
  sync: {
    queueUpsert: syncService.queueUpsertTimeLog,
    queueDelete: syncService.queueDeleteTimeLog,
    syncType: 'timelog',
  },
  hooks: {
    afterCreate: async (timeLog) => {
      await recalculateBalancesForTimeLogs([timeLog]);
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
      await recalculateBalancesForTimeLogs([timeLog]);
    },
    afterDelete: async (timeLog) => {
      await recalculateBalancesForTimeLogs([timeLog]);
    },
  },
  storeName: 'TimeLog',
};

// Create the base store
const baseStore = createBaseStore<TimeLog>(timeLogStoreConfig);


function createTimeLogsStore() {
  return {
    ...baseStore,

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
        notes: timeLogData.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },


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


    async startTimer(timerId: string) {
      const timeLog = await baseStore.create({
        id: crypto.randomUUID(),
        user_id: '', // Will be set by backend
        timer_id: timerId,
        type: 'normal',
        whole_day: false,
        start_timestamp: new Date().toISOString(),
        // No end_timestamp - timer is running
        timezone: userTimezone,
        apply_break_calculation: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return timeLog;
    },

    async stopTimer(timelog: TimeLog, notes?: string, endTimestamp?: string) {
      const allTimeLogs = await get(activeTimeLogs);
      const runningTimer = allTimeLogs.find(tl => tl.id === timelog.id);
      if (!runningTimer) throw new Error('Timer not found');
      
      const now = new Date();
      const endTime = endTimestamp || now.toISOString();
      
      // Update the timer with end timestamp
      const updatedTimeLog = await baseStore.update(timelog.id, {
        end_timestamp: endTime,
        duration_minutes: undefined, // Let saveTimeLog calculate this
        ...(notes !== undefined && { notes }),
      });

      return updatedTimeLog;
    },
  };
}

export const timeLogsStore = createTimeLogsStore();

// Derived store for today's timelogs
export const todayTimeLogs = derived(
  timeLogsStore,
  $timeLogsStore => {
    const today = new Date().toISOString().split('T')[0];
    return $timeLogsStore.items.filter(tl => 
      tl.start_timestamp && tl.start_timestamp.startsWith(today)
    );
  }
);

// Derived store for active timelogs (no end_timestamp)
export const activeTimeLogs = derived(
  timeLogsStore,
  $timeLogsStore => {
    return $timeLogsStore.items.filter(tl => !tl.end_timestamp);
  }
);
