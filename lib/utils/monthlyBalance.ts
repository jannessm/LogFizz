import { time } from 'console';
import { TimeLog, DailyTarget, MonthlyBalance } from '../types/index.js';
import dayjs from './dayjs.js';
import crypto from 'crypto';

export interface EffectiveDateRange {
  effectiveStartDate: dayjs.Dayjs;
  effectiveEndDate: dayjs.Dayjs;
}

export interface BalanceValidation {
  shouldCalculate: boolean;
  reason?: string;
}

/**
 * Calculate due minutes based on target and month
 * Respects starting_from date - only counts days on or after starting_from
 * Respects ending_at date - only counts days on or before ending_at
 * 
 * @param target - Daily target with weekdays, duration_minutes, and optional starting_from/ending_at dates
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

function calculateDurationMinutes(
  log: TimeLog,
  start?: dayjs.Dayjs,
  end?: dayjs.Dayjs
): number {
  if (log.duration_minutes !== undefined && log.duration_minutes !== null) {
    return log.duration_minutes;
  }
  const logStart = dayjs(log.start_timestamp);
  const logEnd = log.end_timestamp ? dayjs(log.end_timestamp) : dayjs();

  let duration = 0;

  let breakDuration = 0;
  if (log.apply_break_calculation) {
    let minutes = logEnd.diff(logStart, 'minute', true);
    if (minutes >= 9 * 60) {
      minutes -= 45;
      breakDuration = 45;
    } else if (minutes >= 6 * 60) {
      minutes -= 30;
      breakDuration = 30;
    }
    duration = Math.max(0, Math.round(minutes));
  } else {
    duration = logEnd.diff(logStart, 'minute', true);
  }

  // Adjust duration if start/end boundaries are provided
  // when a break was applied, we assume the break was taken in the last section
  // 19:30 |-------------| 23:59 (4h29m) => add the break back if we cut off part of the log
  // 00:00 |---break-----| 04:00 (3h31m)
  if (start && end) {
    if (logStart.isBefore(start)) {
      duration -= start.diff(logStart, 'minute', true) - breakDuration;
    }

    if (logEnd.isAfter(end)) {
      duration -= logEnd.diff(end, 'minute', true);
    }

    duration = Math.max(0, Math.round(duration));
  }

  return duration;
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
function calculateWorkedMinutes(
  log: TimeLog,
  target: DailyTarget,
  effectiveStartDate: dayjs.Dayjs,
  effectiveEndDate: dayjs.Dayjs
): number {
  let workedMinutes = 0;
  
  // Get the date(s) this log covers
  const startLogDate = dayjs(log.start_timestamp);
  const endLogDate = log.end_timestamp ? dayjs(log.end_timestamp) : startLogDate;
  
  if (log.type === 'normal') {
    // For normal logs, just return the duration_minutes
    return log.duration_minutes ? log.duration_minutes : calculateDurationMinutes(log, effectiveEndDate, effectiveEndDate);
  }

  // Iterate through each day in the range
  let currentDate = startLogDate.startOf('day');
  const lastDate = endLogDate.startOf('day');
  
  while (currentDate.isSameOrBefore(lastDate)) {
    // Check if this day falls within our calculation period
    if (currentDate.isSameOrAfter(effectiveStartDate) &&
        currentDate.isBefore(effectiveEndDate)) {
      const dayOfWeek = currentDate.day();

      const weekdayIndex = target.weekdays.indexOf(dayOfWeek);
        
      // This day is a target day, add the target duration
      if (weekdayIndex !== -1) {
        const targetDuration = target.duration_minutes[weekdayIndex];
        workedMinutes += targetDuration;
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


export function hashTimeLogs(
  timeLogs: TimeLog[]
): string {
  const hash = crypto.createHash('sha256');
  // sort timelogs on created at timestamp
  timeLogs.sort((a, b) => {
    const ta = dayjs(a.created_at).valueOf();
    const tb = dayjs(b.created_at).valueOf();
    return ta - tb;
  });
  hash.update(timeLogs.toString());
  const hashStr = hash.digest('hex');

  return hashStr;
}


export function calculateMonthlyBalance(
  currentMonthlyBalance: Partial<MonthlyBalance> & {
    target_id: string;
    year: number;
    month: number;
    exclude_holidays: boolean;
  },
  target: DailyTarget,
  timeLogs: TimeLog[],
  holidays: Set<string>,
  previousMonthlyBalance?: { balance_minutes: number },
): Partial<MonthlyBalance> {
  // check timeLogs hash whether monthly balance needs to be recalculated
  if (currentMonthlyBalance?.hash) {
    const hashStr = hashTimeLogs(timeLogs);

    if (hashStr == currentMonthlyBalance.hash) {
      return currentMonthlyBalance;
    } else {
      currentMonthlyBalance.hash = hashStr;
    }
  }

  // Calculate effective date range
  const { effectiveStartDate, effectiveEndDate } = calculateEffectiveDateRange(
    target,
    currentMonthlyBalance.year,
    currentMonthlyBalance.month
  );
  
  // Calculate worked minutes considering special types
  let workedMinutes = 0;
  
  for (const tl of timeLogs) {
    workedMinutes += calculateWorkedMinutes(
      tl,
      target,
      effectiveStartDate,
      effectiveEndDate
    );
  }
  
  // Calculate due minutes based on target
  const dueMinutes = calculateDueMinutes(
    target,
    currentMonthlyBalance.year,
    currentMonthlyBalance.month,
    holidays
  );

  // Calculate this month's balance
  currentMonthlyBalance.balance_minutes = workedMinutes - dueMinutes;

  // Total balance = previous cumulative + this month's balance
  if (previousMonthlyBalance) {
    currentMonthlyBalance.balance_minutes += previousMonthlyBalance.balance_minutes;
  }

  return currentMonthlyBalance;
}
