import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
import { TimeLog } from '../types/index.js';


// Extend dayjs with UTC and timezone plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Set default timezone to UTC for all operations
dayjs.tz.setDefault('UTC');

export interface DailyTarget {
  weekdays: number[]; // 0=Sunday, 6=Saturday
  duration_minutes: number[]; // Duration for each weekday
  starting_from?: Date | null;
  ending_at?: Date | null; // Date at which tracking ends (balance calculated only up to this date)
}

export interface EffectiveDateRange {
  effectiveStartDate: dayjs.Dayjs;
  effectiveEndDate: dayjs.Dayjs;
}

export interface BalanceValidation {
  shouldCalculate: boolean;
  reason?: string;
}

/**
 * Calculate total worked minutes from time logs
 * Uses duration_minutes if available, otherwise calculates from timestamps
 * Respects auto_subtract_breaks flag if provided
 * Break calculation: 30 mins after 6h, 45 mins after 9h
 * 
 * @param timeLogs - Array of time logs with timestamps and optional duration
 * @param rawData - Optional array of raw data containing auto_subtract_breaks flag
 * @returns Total worked minutes (rounded)
 */
export function calculateWorkedMinutes(
  timeLogs: TimeLog[],
  rawData?: Array<{ auto_subtract_breaks?: boolean }>
): number {
  let totalMinutes = 0;
  const now = dayjs();

  for (let i = 0; i < timeLogs.length; i++) {
    const log = timeLogs[i];
    const raw = rawData ? rawData[i] : null;
    
    // Use pre-calculated duration if available, otherwise calculate from timestamps
    let minutes = log.duration_minutes;
    if (minutes === undefined || minutes === null) {
      const startTime = dayjs(log.start_timestamp);
      // For running sessions (no end_timestamp), calculate duration to current time
      const endTime = log.end_timestamp ? dayjs(log.end_timestamp) : now;
      minutes = endTime.diff(startTime, 'minute', true);
    }
    
    // Apply break subtraction if auto_subtract_breaks is enabled
    const autoSubtractBreaks = raw?.auto_subtract_breaks ?? false;
    if (autoSubtractBreaks && minutes > 0) {
      // German break rules: 30 min after 6h, additional 15 min (total 45) after 9h
      if (minutes >= 9 * 60) {
        minutes -= 45; // 45 minutes break for 9+ hours
      } else if (minutes >= 6 * 60) {
        minutes -= 30; // 30 minutes break for 6-9 hours
      }
    }
    
    totalMinutes += Math.max(0, minutes);
  }

  return Math.round(totalMinutes);
}

/**
 * Calculate due minutes based on target and month
 * Respects starting_from date - only counts days on or after starting_from
 * Respects ending_at date - only counts days on or before ending_at
 * 
<<<<<<< HEAD
 * @param target - Daily target with weekdays, duration_minutes, and optional starting_from/ending_at dates
=======
 * @param target - Daily target with weekdays, duration_minutes, starting_from, and ending_at
>>>>>>> 37e2d80 (Add ending_at field to DailyTarget type and implement end date handling)
 * @param year - Year (e.g., 2025)
 * @param month - Month (1-12)
 * @param holidays - Set of holiday dates in YYYY-MM-DD format to exclude
 * @returns Total due minutes for the month
 */
export function calculateDueMinutes(
  target: DailyTarget,
  year: number,
  month: number,
  holidays: Set<string> = new Set()
): number {
  let totalMinutes = 0;

  // Get starting_from date if set
  const startingFrom = target.starting_from ? dayjs(target.starting_from).utc() : null;
  
  // Get ending_at date if set
  const endingAt = target.ending_at ? dayjs(target.ending_at).utc() : null;

  // Iterate through each day of the month using dayjs
  const monthStart = dayjs.utc(`${year}-${month.toString().padStart(2, '0')}-01`);
  const daysInMonth = monthStart.daysInMonth();
  
  // Get today's date to avoid counting future days in the current month
  const today = dayjs().utc();
  const isCurrentMonth = today.year() === year && today.month() + 1 === month;
  let lastDayToCount = isCurrentMonth ? Math.min(today.date(), daysInMonth) : daysInMonth;
  
  // If ending_at is set and is in this month, limit lastDayToCount to ending_at
  if (endingAt) {
    const endingAtYear = endingAt.year();
    const endingAtMonth = endingAt.month() + 1;
    if (endingAtYear === year && endingAtMonth === month) {
      // ending_at is in this month, limit to ending_at date
      lastDayToCount = Math.min(lastDayToCount, endingAt.date());
    } else if (endingAt.isBefore(monthStart)) {
      // The entire month is after ending_at, no due minutes
      return 0;
    }
  }
  
  for (let day = 1; day <= lastDayToCount; day++) {
    const date = monthStart.date(day);
    const dayOfWeek = date.day(); // 0=Sunday, 6=Saturday
    const dateString = date.format('YYYY-MM-DD');

    // Skip days before starting_from
    if (startingFrom && date.isBefore(startingFrom, 'day')) {
      continue;
    }
    
    // Skip days after ending_at
    if (endingAt && date.isAfter(endingAt, 'day')) {
      continue;
    }

    // Check if this day is in the target's weekdays
    if (target.weekdays.includes(dayOfWeek)) {
      // Check if we should exclude this day because it's a holiday
      if (holidays.has(dateString)) {
        continue;
      }

      // Get the duration for this day of week
      // duration_minutes array should match weekdays array
      const dayIndex = target.weekdays.indexOf(dayOfWeek);
      if (dayIndex >= 0 && dayIndex < target.duration_minutes.length) {
        totalMinutes += target.duration_minutes[dayIndex];
      }
    }
  }

  return totalMinutes;
}

/**
 * Get affected months from a list of time logs
 * Returns the earliest month that should be recalculated
 * 
 * @param timeLogs - Array of time logs with start_timestamp
 * @returns Earliest affected month as dayjs object, or null if no logs
 */
export function getEarliestAffectedMonth(timeLogs: Array<{ start_timestamp: Date }>): dayjs.Dayjs | null {
  if (timeLogs.length === 0) {
    return null;
  }

  let earliestDate: dayjs.Dayjs | null = null;
  
  for (const log of timeLogs) {
    const date = dayjs(log.start_timestamp).utc().startOf('month');
    if (!earliestDate || date.isBefore(earliestDate)) {
      earliestDate = date;
    }
  }

  return earliestDate;
}

/**
 * Calculate worked minutes for special log types (sick, holiday, business-trip, child-sick)
 * Uses target duration for each weekday in the log's date range
 * 
 * @param log - Time log with type, start and end timestamps
 * @param target - Daily target with weekdays and duration_minutes
 * @param effectiveStartDate - Start of the calculation period
 * @param effectiveEndDate - End of the calculation period
 * @returns Total worked minutes for special type logs
 */
export function calculateWorkedMinutesForSpecialType(
  log: TimeLogWithType,
  target: DailyTarget,
  effectiveStartDate: dayjs.Dayjs,
  effectiveEndDate: dayjs.Dayjs
): number {
  let workedMinutes = 0;
  
  // Get the date(s) this log covers
  const startLogDate = dayjs(log.start_timestamp);
  const endLogDate = log.end_timestamp ? dayjs(log.end_timestamp) : startLogDate;
  
  // Iterate through each day in the range
  let currentDate = startLogDate.startOf('day');
  const lastDate = endLogDate.startOf('day');
  
  while (currentDate.isSameOrBefore(lastDate)) {
    // Check if this day falls within our calculation period
    if (currentDate.isSameOrAfter(effectiveStartDate) && currentDate.isBefore(effectiveEndDate)) {
      const dayOfWeek = currentDate.day();
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const weekdayIndex = target.weekdays.indexOf(dayOfWeek);
        
        if (weekdayIndex !== -1) {
          // This day is a target day, add the target duration
          const targetDuration = target.duration_minutes[weekdayIndex];
          workedMinutes += targetDuration;
        }
      }
    }
    currentDate = currentDate.add(1, 'day');
  }
  
  return workedMinutes;
}

/**
 * Calculate effective date range for monthly balance calculation
 * Considers starting_from, ending_at, and month boundaries
 * 
 * @param target - Daily target with starting_from and ending_at dates
 * @param year - Year (e.g., 2025)
 * @param month - Month (1-12)
 * @returns Effective start and end dates for calculations
 */
export function calculateEffectiveDateRange(
  target: DailyTarget,
  year: number,
  month: number
): EffectiveDateRange {
  const startingFrom = target.starting_from ? dayjs(target.starting_from).utc() : null;
  const endingAt = target.ending_at ? dayjs(target.ending_at).utc() : null;
  
  // Calculate date range for the month
  const startDate = dayjs.utc(`${year}-${month.toString().padStart(2, '0')}-01`).startOf('day');
  const endDate = startDate.add(1, 'month');
  
  // Calculate the effective start date for time logs
  const effectiveStartDate = (startingFrom && startingFrom.isAfter(startDate)) 
    ? startingFrom 
    : startDate;
  
  // Calculate the effective end date for time logs (min of month end or ending_at + 1 day)
  let effectiveEndDate = endDate;
  if (endingAt && endingAt.isBefore(endDate.subtract(1, 'day'))) {
    // ending_at is within this month, limit to day after ending_at
    effectiveEndDate = endingAt.add(1, 'day').startOf('day');
  }
  
  return { effectiveStartDate, effectiveEndDate };
}

/**
 * Validate whether a balance should be calculated for a given target and month
 * Checks for starting_from date and whether month is within tracking period
 * 
 * @param target - Daily target with starting_from and ending_at dates
 * @param year - Year (e.g., 2025)
 * @param month - Month (1-12)
 * @returns Validation result with shouldCalculate flag and optional reason
 */
export function shouldCalculateBalance(
  target: DailyTarget,
  year: number,
  month: number
): BalanceValidation {
  const startingFrom = target.starting_from ? dayjs(target.starting_from).utc() : null;
  const endingAt = target.ending_at ? dayjs(target.ending_at).utc() : null;
  
  // Do not calculate balance if no starting_from is set
  if (!startingFrom) {
    return { 
      shouldCalculate: false, 
      reason: 'No starting_from date set' 
    };
  }
  
  // Calculate date range for the month
  const startDate = dayjs.utc(`${year}-${month.toString().padStart(2, '0')}-01`).startOf('day');
  const endDate = startDate.add(1, 'month');
  
  // Check if this month is before the starting_from date
  if (endDate.isBefore(startingFrom) || endDate.isSame(startingFrom)) {
    return { 
      shouldCalculate: false, 
      reason: 'Month is entirely before starting_from date' 
    };
  }
  
  // Check if this month is entirely after the ending_at date
  if (endingAt && startDate.isAfter(endingAt)) {
    return { 
      shouldCalculate: false, 
      reason: 'Month is entirely after ending_at date' 
    };
  }
  
  return { shouldCalculate: true };
}

/**
 * Get the cumulative balance from the previous month
 * Returns 0 if there's no previous balance or if before starting_from
 * 
 * @param year - Current year
 * @param month - Current month (1-12)
 * @param startingFrom - Starting date for tracking (null if not set)
 * @param getPreviousBalanceMinutes - Function to fetch previous month's balance_minutes
 * @returns Previous month's cumulative balance or 0
 */
export async function getPreviousMonthCumulativeBalance(
  year: number,
  month: number,
  startingFrom: dayjs.Dayjs | null,
  getPreviousBalanceMinutes: (year: number, month: number) => Promise<number>
): Promise<number> {
  const currentMonth = dayjs.utc(`${year}-${month.toString().padStart(2, '0')}-01`);
  const previousMonth = currentMonth.subtract(1, 'month');
  const prevYear = previousMonth.year();
  const prevMonth = previousMonth.month() + 1;
  
  // Check if previous month is entirely before starting_from
  if (startingFrom) {
    const currentMonthStart = currentMonth.startOf('day');
    if (startingFrom.isAfter(currentMonthStart) || startingFrom.isSame(currentMonthStart)) {
      return 0;
    }
  }
  
  // Get previous month's balance using the provided function
  return await getPreviousBalanceMinutes(prevYear, prevMonth);
}

/**
 * Core monthly balance calculation
 * Calculates worked minutes, due minutes, and balance for a given month
 * 
 * @param config - Configuration object with all necessary parameters
 * @returns Object with worked_minutes, due_minutes, and balance_minutes
 */
export async function calculateMonthlyBalanceCore(config: {
  target: DailyTarget;
  year: number;
  month: number;
  timeLogs: TimeLogWithType[];
  buttonBreakMap: Map<string, boolean>;
  holidays: Set<string>;
  previousMonthBalance: number;
}): Promise<{
  worked_minutes: number;
  due_minutes: number;
  balance_minutes: number;
}> {
  const { target, year, month, timeLogs, buttonBreakMap, holidays, previousMonthBalance } = config;
  
  // Calculate effective date range
  const { effectiveStartDate, effectiveEndDate } = calculateEffectiveDateRange(target, year, month);
  
  // Calculate worked minutes considering special types
  let workedMinutes = 0;
  
  for (const tl of timeLogs) {
    const logType = tl.type || 'normal';
    
    if (logType === 'normal') {
      // For normal logs, use actual worked duration
      let minutes = tl.duration_minutes;
      
      if (minutes === undefined || minutes === null) {
        // Calculate from timestamps only if duration is not stored
        const autoSubtractBreaks = (tl.button_id && buttonBreakMap.has(tl.button_id)) 
          ? buttonBreakMap.get(tl.button_id) ?? false 
          : false;
        const startTime = dayjs(tl.start_timestamp);
        const endTime = tl.end_timestamp ? dayjs(tl.end_timestamp) : dayjs();
        minutes = endTime.diff(startTime, 'minute', true);
        
        // Apply break subtraction if enabled (only when calculating from timestamps)
        if (autoSubtractBreaks && minutes > 0) {
          if (minutes >= 9 * 60) {
            minutes -= 45;
          } else if (minutes >= 6 * 60) {
            minutes -= 30;
          }
        }
      }
      // If duration_minutes exists, use it as-is (breaks already subtracted during save)
      
      workedMinutes += Math.max(0, Math.round(minutes));
    } else {
      // For special types (sick, holiday, business-trip, child-sick), use target duration
      workedMinutes += calculateWorkedMinutesForSpecialType(tl, target, effectiveStartDate, effectiveEndDate);
    }
  }
  
  // Calculate due minutes based on target
  const dueMinutes = calculateDueMinutes(target, year, month, holidays);
  
  // Calculate this month's balance
  const thisMonthBalance = workedMinutes - dueMinutes;
  
  // Total balance = previous cumulative + this month's balance
  const balanceMinutes = previousMonthBalance + thisMonthBalance;
  
  return {
    worked_minutes: workedMinutes,
    due_minutes: dueMinutes,
    balance_minutes: balanceMinutes,
  };
}
