import { derived, type Readable } from 'svelte/store';
import { timeLogsStore } from '../stores/timelogs';
import type { TimeLog, Timer } from '../types';
import { dayjs } from '../types';

// Get user's timezone
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Interface for multi-day range information
 */
export interface MultiDayRangeInfo {
  isInRange: boolean;
  isStart: boolean;
  isEnd: boolean;
  isMiddle: boolean;
  color: string | null;
}

/**
 * Interface for calendar timelog data organized by date
 */
export interface CalendarTimeLogData {
  /** Map of date (YYYY-MM-DD) to timelogs for that date */
  timeLogsByDate: Map<string, TimeLog[]>;
  /** Map of date (YYYY-MM-DD) to dot colors (max 3) */
  dotColors: Map<string, string[]>;
  /** Map of date (YYYY-MM-DD) to multi-day range info */
  multiDayRanges: Map<string, MultiDayRangeInfo>;
}

/**
 * Create a derived store that provides calendar-optimized timelog data
 * for a specific month range
 * 
 * @param year - Year to display (e.g., 2026)
 * @param month - Month to display (1-12)
 * @param range - Number of months before/after to include (default: 1)
 * @param timers - Array of timers for color lookup
 * @returns Readable store with calendar data
 */
export function createCalendarStore(
  year: number,
  month: number,
  range: number = 1,
  timers: Timer[]
): Readable<CalendarTimeLogData> {
  return derived(timeLogsStore, ($timeLogsStore) => {
    // Calculate which months to include
    const targetMonths: Array<{ year: number; month: number }> = [];
    for (let i = -range; i <= range; i++) {
      const targetDate = dayjs()
        .year(year)
        .month(month - 1)
        .date(1)
        .add(i, 'month');
      targetMonths.push({
        year: targetDate.year(),
        month: targetDate.month() + 1,
      });
    }

    // Filter timelogs for the target months
    const relevantLogs = $timeLogsStore.items.filter((tl: TimeLog) => {
      const logYear = tl.year ?? dayjs(tl.start_timestamp).tz(userTimezone).year();
      const logMonth = tl.month ?? dayjs(tl.start_timestamp).tz(userTimezone).month() + 1;
      
      return targetMonths.some(
        (target) => target.year === logYear && target.month === logMonth
      );
    });

    // Build timeLogsByDate map - map timelogs to ALL dates they span
    const timeLogsByDate = new Map<string, TimeLog[]>();
    for (const tl of relevantLogs) {
      if (!tl.start_timestamp) continue;

      const logTimezone = tl.timezone || userTimezone;
      const startDate = dayjs.utc(tl.start_timestamp).tz(logTimezone);
      const endDate = tl.end_timestamp 
        ? dayjs.utc(tl.end_timestamp).tz(logTimezone)
        : dayjs(); // Use now for running timelogs
      
      // Add timelog to all dates it spans
      let currentDate = startDate.startOf('day');
      const endDay = endDate.startOf('day');
      
      while (currentDate.isSameOrBefore(endDay, 'day')) {
        const dateStr = currentDate.format('YYYY-MM-DD');
        
        if (!timeLogsByDate.has(dateStr)) {
          timeLogsByDate.set(dateStr, []);
        }
        timeLogsByDate.get(dateStr)!.push(tl);
        
        currentDate = currentDate.add(1, 'day');
      }
    }

    // Build dotColors map (max 3 colors per day based on entire timespan)
    const dotColors = new Map<string, string[]>();
    for (const [dateStr, logs] of timeLogsByDate.entries()) {
      const colorSet = new Map<string, string>();
      
      for (const tl of logs) {
        if (!colorSet.has(tl.timer_id)) {
          const timer = timers.find((t) => t.id === tl.timer_id);
          colorSet.set(tl.timer_id, timer?.color || '#3B82F6');
        }
      }
      
      dotColors.set(dateStr, Array.from(colorSet.values()).slice(0, 3));
    }

    // Build multiDayRanges map - pre-compute multi-day range info for each date
    const multiDayRanges = new Map<string, MultiDayRangeInfo>();
    
    // Calculate the calendar range we need to check
    const firstMonth = dayjs().year(year).month(month - 1).date(1).subtract(range, 'month');
    const lastMonth = dayjs().year(year).month(month - 1).date(1).add(range + 1, 'month');
    
    let currentDay = firstMonth.startOf('month');
    while (currentDay.isBefore(lastMonth, 'day')) {
      const dateStr = currentDay.format('YYYY-MM-DD');
      const rangeInfo = calculateMultiDayRange(currentDay, relevantLogs);
      multiDayRanges.set(dateStr, rangeInfo);
      currentDay = currentDay.add(1, 'day');
    }

    return {
      timeLogsByDate,
      dotColors,
      multiDayRanges,
    };
  });
}

/**
 * Calculate multi-day range information for a specific date
 * Internal helper function
 */
function calculateMultiDayRange(
  date: dayjs.Dayjs,
  timeLogs: TimeLog[]
): MultiDayRangeInfo {
  for (const tl of timeLogs) {
    if (!tl.type || tl.type === 'normal') continue;
    if (!tl.start_timestamp || !tl.end_timestamp) continue;

    // Convert timestamps to user's timezone
    const logTimezone = tl.timezone || userTimezone;
    const start = dayjs.utc(tl.start_timestamp).tz(logTimezone);
    const end = dayjs.utc(tl.end_timestamp).tz(logTimezone);

    // Check if this is a multi-day log (more than 1 day)
    const daysDiff = end.diff(start, 'day');
    if (daysDiff >= 1) {
      const current = date.startOf('day');
      const rangeStart = start.startOf('day');
      const rangeEnd = end.startOf('day');

      if (current.isSame(rangeStart, 'day')) {
        return {
          isInRange: true,
          isStart: true,
          isEnd: false,
          isMiddle: false,
          color: getTypeColor(tl.type),
        };
      } else if (current.isSame(rangeEnd, 'day')) {
        return {
          isInRange: true,
          isStart: false,
          isEnd: true,
          isMiddle: false,
          color: getTypeColor(tl.type),
        };
      } else if (current.isAfter(rangeStart) && current.isBefore(rangeEnd)) {
        return {
          isInRange: true,
          isStart: false,
          isEnd: false,
          isMiddle: true,
          color: getTypeColor(tl.type),
        };
      }
    }
  }

  return {
    isInRange: false,
    isStart: false,
    isEnd: false,
    isMiddle: false,
    color: null,
  };
}

/**
 * Get timelog type colors
 */
export function getTypeColor(type: string): string | null {
  switch (type) {
    case 'sick':
      return '#EF4444'; // Red
    case 'holiday':
      return '#10B981'; // Green
    case 'business-trip':
      return '#F59E0B'; // Orange/Amber
    case 'child-sick':
      return '#EC4899'; // Pink
    case 'normal':
    default:
      return null; // null means use timer color
  }
}

/**
 * Check if a date is within a multi-day timelog range
 */
export function getMultiDayRange(
  date: dayjs.Dayjs,
  timeLogs: TimeLog[]
): {
  isInRange: boolean;
  isStart: boolean;
  isEnd: boolean;
  color: string | null;
  isMiddle: boolean;
} {
  for (const tl of timeLogs) {
    if (!tl.type || tl.type === 'normal') continue;
    if (!tl.start_timestamp || !tl.end_timestamp) continue;

    // Convert timestamps to user's timezone
    const logTimezone = tl.timezone || userTimezone;
    const start = dayjs.utc(tl.start_timestamp).tz(logTimezone);
    const end = dayjs.utc(tl.end_timestamp).tz(logTimezone);

    // Check if this is a multi-day log (more than 1 day)
    const daysDiff = end.diff(start, 'day');
    if (daysDiff >= 1) {
      const current = date.startOf('day');
      const rangeStart = start.startOf('day');
      const rangeEnd = end.startOf('day');

      if (current.isSame(rangeStart, 'day')) {
        return {
          isInRange: true,
          isStart: true,
          isEnd: false,
          isMiddle: false,
          color: getTypeColor(tl.type),
        };
      } else if (current.isSame(rangeEnd, 'day')) {
        return {
          isInRange: true,
          isStart: false,
          isEnd: true,
          isMiddle: false,
          color: getTypeColor(tl.type),
        };
      } else if (current.isAfter(rangeStart) && current.isBefore(rangeEnd)) {
        return {
          isInRange: true,
          isStart: false,
          isEnd: false,
          isMiddle: true,
          color: getTypeColor(tl.type),
        };
      }
    }
  }

  return {
    isInRange: false,
    isStart: false,
    isEnd: false,
    isMiddle: false,
    color: null,
  };
}

/**
 * Check if a date has any special type timelogs (non-normal) - single day only
 */
export function hasSpecialType(
  date: dayjs.Dayjs,
  timeLogsByDate: Map<string, TimeLog[]>,
  timeLogs: TimeLog[]
): { hasSpecial: boolean; color: string | null } {
  // First check if it's part of a multi-day range
  const multiDay = getMultiDayRange(date, timeLogs);
  if (multiDay.isInRange) {
    return { hasSpecial: false, color: null }; // Will be handled by range display
  }

  const dateStr = date.format('YYYY-MM-DD');
  const dateTimeLogs = timeLogsByDate.get(dateStr) || [];

  for (const tl of dateTimeLogs) {
    if (tl.type && tl.type !== 'normal') {
      // Make sure it's not a multi-day log
      if (tl.end_timestamp) {
        const logTimezone = tl.timezone || userTimezone;
        const start = dayjs.utc(tl.start_timestamp).tz(logTimezone);
        const end = dayjs.utc(tl.end_timestamp).tz(logTimezone);
        const daysDiff = end.diff(start, 'day');
        if (daysDiff < 1) {
          return { hasSpecial: true, color: getTypeColor(tl.type) };
        }
      }
    }
  }

  return { hasSpecial: false, color: null };
}

/**
 * Load timelogs for a specific month range
 * This ensures the data is available in the store
 * 
 * @param year - Year to load
 * @param month - Month to load (1-12)
 * @param range - Number of months before/after to load (default: 1)
 */
export async function loadCalendarMonth(
  year: number,
  month: number,
  range: number = 1
): Promise<void> {
  const promises = [];
  
  for (let i = -range; i <= range; i++) {
    const monthToLoad = dayjs()
      .year(year)
      .month(month - 1)
      .date(1)
      .add(i, 'month');
    
    promises.push(
      timeLogsStore.loadLogsByYearMonth(
        monthToLoad.year(),
        monthToLoad.month() + 1
      )
    );
  }
  
  await Promise.all(promises);
}
