import { derived, type Readable } from 'svelte/store';
import { timeLogsStore } from '../stores/timelogs';
import { holidaysStore } from '../stores/holidays';
import { mapToArray } from '../stores/base-store';
import type { TimeLog, Timer, Holiday, TargetWithSpecs } from '../types';
import { dayjs } from '../types';

// Get user's timezone
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;



/**
 * Interface for multi-day range information
 * Supports multiple overlapping ranges with gradient colors
 */
export interface MultiDayRangeInfo {
  isInRange: boolean;
  isStart: boolean;
  isEnd: boolean;
  isMiddle: boolean;
  colors: string[]; // Array of colors for gradient display
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
  /** Map of date (YYYY-MM-DD) to relevant holidays that affect balance calculations */
  relevantHolidays: Map<string, Holiday[]>;
}

/**
 * Create a derived store that provides calendar-optimized timelog data
 * for a specific month range
 * 
 * @param year - Year to display (e.g., 2026)
 * @param month - Month to display (1-12)
 * @param range - Number of months before/after to include (default: 1)
 * @param timers - Array of timers for color lookup
 * @param targets - Array of targets for holiday filtering
 * @returns Readable store with calendar data
 */
export function createCalendarStore(
  year: number,
  month: number,
  range: number = 1,
  timers: Timer[],
  targets: TargetWithSpecs[]
): Readable<CalendarTimeLogData> {
  return derived([timeLogsStore, holidaysStore], ([$timeLogsStore, $holidaysStore]) => {
    // Compute the full calendar date range this store covers
    const firstMonth = dayjs().year(year).month(month - 1).date(1).subtract(range, 'month');
    const lastMonth = dayjs().year(year).month(month - 1).date(1).add(range, 'month');
    const rangeStart = firstMonth.startOf('month');
    const rangeEnd = lastMonth.endOf('month');

    // A timelog is relevant if it overlaps with [rangeStart, rangeEnd].
    // This correctly includes:
    //   - timelogs whose start OR end falls within the range
    //   - timelogs that start before and end after the range (spanning the whole view)
    const relevantLogs = mapToArray($timeLogsStore.items).filter((tl: TimeLog) => {
      if (tl.deleted_at) return false;

      const logTimezone = tl.timezone || userTimezone;
      const logStart = dayjs.utc(tl.start_timestamp).tz(logTimezone).startOf('day');
      const logEnd = tl.end_timestamp
        ? dayjs.utc(tl.end_timestamp).tz(logTimezone).startOf('day')
        : dayjs(); // running timelog extends to now

      // Overlap condition: log starts before range ends AND log ends after range starts
      return logStart.isSameOrBefore(rangeEnd, 'day') && logEnd.isSameOrAfter(rangeStart, 'day');
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
        if (!colorSet.has(tl.timer_id) && !tl.whole_day) {
          const timer = timers.find((t) => t.id === tl.timer_id);
          colorSet.set(tl.timer_id, timer?.color || '#3B82F6');
        }
      }
      
      dotColors.set(dateStr, Array.from(colorSet.values()).slice(0, 3));
    }

    
    // Calculate the calendar range we need to check (reuse rangeStart/rangeEnd computed above)
    // Build multiDayRanges map - pre-compute multi-day range info for each date
    const multiDayRanges = calculateMultiDayRange(rangeStart, rangeEnd, relevantLogs);

    // Build relevantHolidays map - filter holidays that affect balance calculations
    const relevantHolidays = new Map<string, Holiday[]>();
    
    // Reset to check the same range for holidays
    let currentDay = rangeStart;
    while (currentDay.isSameOrBefore(rangeEnd, 'day')) {
      const dateStr = currentDay.format('YYYY-MM-DD');
      const holidays = getRelevantHolidaysForDate(currentDay, targets, $holidaysStore.holidays);
      if (holidays.length > 0) {
        relevantHolidays.set(dateStr, holidays);
      }
      currentDay = currentDay.add(1, 'day');
    }

    return {
      timeLogsByDate,
      dotColors,
      multiDayRanges,
      relevantHolidays,
    };
  });
}
/**
 * Calculate multi-day range information for a specific date
 * Handles multiple overlapping ranges and returns gradient colors
 * 
 * Logic for overlapping ranges:
 * - If multiple ranges start or end on the same date, treat it as a middle (isMiddle)
 *   to create a seamless blend between ranges
 * - Collect all colors from ranges that touch this date for gradient display
 */
function calculateMultiDayRange(
  startDate: dayjs.Dayjs,
  endDate: dayjs.Dayjs,
  timeLogs: TimeLog[]
): Map<string, MultiDayRangeInfo> {
  const multidayRanges = new Map<string, MultiDayRangeInfo>();
  timeLogs.sort((a, b) => {
    const aStart = dayjs.utc(a.start_timestamp);
    const bStart = dayjs.utc(b.start_timestamp);
    return aStart.isBefore(bStart) ? -1 : aStart.isAfter(bStart) ? 1 : 0;
  });

  for (const tl of timeLogs) {
    if (!tl.type || tl.type === 'normal') continue;
    if (!tl.start_timestamp) continue;

    // Convert timestamps to user's timezone
    const logTimezone = tl.timezone || userTimezone;
    const start = dayjs.utc(tl.start_timestamp).tz(logTimezone).startOf('day');
    const end = dayjs.utc(tl.end_timestamp).tz(logTimezone).endOf('day') || dayjs.utc().tz(logTimezone).endOf('day');

    // If the end date is before the start date, skip this log
    if (start.isAfter(endDate) || end.isBefore(startDate)) continue;

    // Check if this is a multi-day log (more than 1 day)
    if (start.format('YYYY-MM-DD') === end.format('YYYY-MM-DD')) continue;

    let current = start.startOf('day');
    while (current.isBefore(end, 'hour')) {
      const date = current.format('YYYY-MM-DD');
      const rangeEntry = multidayRanges.get(date);
      const isStart = date === start.format('YYYY-MM-DD');
      const isEnd = date === end.format('YYYY-MM-DD');
      const isMiddle = !isStart && !isEnd;
      const color = getTypeColor(tl.type)!;
    
      if (!rangeEntry || rangeEntry.colors.length === 0) {
        multidayRanges.set(date, {
          isInRange: true,
          isStart: isStart,
          isEnd: isEnd,
          isMiddle: isMiddle,
          colors: [color],
        });
      } else {
        // Update existing entry
        rangeEntry.isStart = rangeEntry.isStart && isStart;
        rangeEntry.isEnd = rangeEntry.isEnd && isEnd;
        rangeEntry.isMiddle = !rangeEntry.isStart && !rangeEntry.isEnd;
        if (!rangeEntry.colors.includes(color)) {
          rangeEntry.colors.push(color);
        }
        multidayRanges.set(date, rangeEntry);
      }

      current = current.add(1, 'day');
    }
  }

  return multidayRanges;
}

/**
 * Get holidays for a date that affect balance calculations.
 * A holiday is only relevant if:
 * - There's a target spec with exclude_holidays: true
 * - The spec has a state_code set
 * - The date falls within the spec's date range
 * - The holiday is for that specific state/country
 */
function getRelevantHolidaysForDate(
  date: dayjs.Dayjs,
  targets: TargetWithSpecs[],
  allHolidays: Holiday[]
): Holiday[] {
  const dateStr = date.format('YYYY-MM-DD');
  const relevantHolidays: Holiday[] = [];
  const addedHolidayIds = new Set<string>();
  
  // Check each target's specs for holidays that affect balance
  for (const target of targets) {
    for (const spec of target.target_specs || []) {
      // Only consider specs that exclude holidays and have a state code
      if (!spec.exclude_holidays || !spec.state_code) continue;
      
      // Check if date is within this spec's range
      const startDate = dayjs(spec.starting_from);
      const endDate = spec.ending_at ? dayjs(spec.ending_at) : null;
      
      if (date.isBefore(startDate, 'day')) continue;
      if (endDate && date.isAfter(endDate, 'day')) continue;
      
      // Get the country code from state_code (e.g., 'DE-BW' -> 'DE')
      const countryCode = spec.state_code.split('-')[0];
      
      // Check if it's a holiday in this country/state
      const holiday = allHolidays.find(
        h => h.country === countryCode && h.date === dateStr
      );
      
      if (holiday && !addedHolidayIds.has(holiday.id)) {
        // If global holiday or specific to this state
        if (holiday.counties.length === 0 || 
            holiday.counties.includes(spec.state_code)) {
          relevantHolidays.push(holiday);
          addedHolidayIds.add(holiday.id);
        }
      }
    }
  }
  
  return relevantHolidays;
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
    case 'homeoffice':
      return '#06B6D4'; // Cyan
    case 'normal':
    default:
      return null; // null means use timer color
  }
}

/**
 * Check if a date has any special type timelogs (non-normal) - single day only
 */
export function hasSpecialType(
  date: dayjs.Dayjs,
  timeLogsByDate: Map<string, TimeLog[]>,
  timeLogs: TimeLog[],
  multiDay: MultiDayRangeInfo
): { hasSpecial: boolean; color: string | null } {
  // First check if it's part of a multi-day range
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
  // Calculate the full date range to load (first day of earliest month to last day of latest month)
  const firstMonth = dayjs().year(year).month(month - 1).date(1).subtract(range, 'month');
  const lastMonth = dayjs().year(year).month(month - 1).date(1).add(range, 'month');
  const startDate = firstMonth.format('YYYY-MM-DD');
  const endDate = lastMonth.endOf('month').format('YYYY-MM-DD');

  // Use the date index to load all timelogs that span any day in the range.
  // This correctly handles multi-month timelogs (e.g. a holiday starting in
  // December that extends into January) which would be missed by per-month queries.
  await timeLogsStore.loadLogsByDateRange(startDate, endDate);
}
