/**
 * Balance Calculation Utilities
 * 
 * This module implements the balance calculation logic as specified in docs/balances.md
 * All balances are calculated bottom-up: Daily -> Monthly -> Yearly
 */

import dayjs from './dayjs.js';
import type { TimeLog, TargetSpec, Balance as BaseBalance, TimeLogType } from '../types/index.js';

/**
 * Extended Target type that includes nested target_specs
 * Used for balance calculations
 */
export interface Target {
  id: string;
  user_id: string;
  name: string;
  target_specs: TargetSpec[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Balance type alias for internal use
 */
export type Balance = BaseBalance;

/**
 * Balance granularity types
 */
export type BalanceGranularity = 'daily' | 'monthly' | 'yearly';

/**
 * Counters for whole day timelog types
 */
export interface WholeDayCounters {
  sick_days: number;
  holidays: number;
  business_trip: number;
  child_sick: number;
  homeoffice: number;
}

/**
 * Result of calculating worked minutes for a specific date
 */
export interface WorkedCalculation {
  worked_minutes: number;
  counters: WholeDayCounters;
}

/**
 * Get the effective date range for a timelog within a specific day
 * Clips the timelog's start/end to the day boundaries in the given timezone
 * 
 * @param date - The date to calculate for (YYYY-MM-DD)
 * @param start - Timelog start timestamp
 * @param end - Timelog end timestamp (optional for running timelogs)
 * @param timezone - Timezone to use for day boundaries (defaults to UTC)
 * @returns Effective start and end times clipped to the day
 */
export function getEffectiveRange(
  date: string,
  start: string,
  end?: string | null,
  timezone?: string
): { effectiveStart: dayjs.Dayjs; effectiveEnd: dayjs.Dayjs } | null {
  // Parse day boundaries in the timelog's timezone so that a Berlin log
  // from 00:30-01:30 is attributed to the correct Berlin date
  const tz = timezone || 'UTC';
  const dayStart = dayjs.tz(date, tz).startOf('day');
  const dayEnd = dayjs.tz(date, tz).endOf('day');
  
  const logStart = dayjs.utc(start);
  const logEnd = end ? dayjs.utc(end) : dayjs.utc(); // Use current time for running logs
  
  // Check if timespans overlap
  if (logEnd.isBefore(dayStart) || logStart.isAfter(dayEnd)) {
    return null; // No overlap
  }
  
  // Clip to day boundaries
  let effectiveStart = logStart.isAfter(dayStart) ? logStart : dayStart;
  let effectiveEnd = logEnd.isBefore(dayEnd) ? logEnd : dayEnd;
  
  return { effectiveStart, effectiveEnd };
}

/**
 * Calculate duration for a timelog
 * For whole_day timelogs, returns -1
 * Otherwise calculates from timerange with break subtraction if applicable
 * 
 * @param timelog - The timelog to calculate duration for
 * @returns Duration in minutes, or -1 for whole-day entries
 */
export function calculateTimelogDuration(timelog: TimeLog): number {
  // Whole day entries return -1
  if (timelog.whole_day) {
    return -1;
  }
  
  // Use existing duration_minutes if available
  if (timelog.duration_minutes != null && timelog.duration_minutes > 0) {
    return timelog.duration_minutes;
  }

  // Calculate from timestamps
  if (!timelog.start_timestamp || !timelog.end_timestamp) {
    return 0;
  }
  
  const start = dayjs.utc(timelog.start_timestamp);
  const end = dayjs.utc(timelog.end_timestamp);
  let duration = end.diff(start, 'minute');
  
  // Apply break calculation if enabled
  if (timelog.apply_break_calculation && duration > 0) {
    if (duration >= 9 * 60) {
      duration -= 45; // 45 min break for 9+ hours
    } else if (duration >= 6 * 60) {
      duration -= 30; // 30 min break for 6-9 hours
    }
  }
  
  return Math.max(0, duration);
}

/**
 * Calculate worked minutes and special day counters for a specific date
 * 
 * @param date - The date to calculate for (YYYY-MM-DD)
 * @param timelogs - Array of timelogs to process
 * @param dueMinutes - Due minutes for this date (used to determine if counters should increment)
 * @returns Worked minutes and counters for special day types
 */
export function calculateWorkedMinutesForDate(
  date: string,
  timelogs: TimeLog[],
  dueMinutes: number = 0
): WorkedCalculation {
  let worked = 0;

  const counters: WholeDayCounters = {
    sick_days: 0,
    holidays: 0,
    business_trip: 0,
    child_sick: 0,
    homeoffice: 0,
  };
  
  for (const timelog of timelogs) {
    // Use the timelog's own timezone for day boundary calculations
    const logTimezone = timelog.timezone || 'UTC';

    // Get effective range for this date in the timelog's timezone
    const range = getEffectiveRange(date, timelog.start_timestamp, timelog.end_timestamp, logTimezone);
    if (!range) continue; // Timelog doesn't overlap with this date
    
    const duration = calculateTimelogDuration(timelog);
    const type = timelog.type || 'normal';
    
    // update counters, for sick, holiday, child-sick only when dueminutes > 0 (day where one should actually work)
    if (type === 'sick' && dueMinutes > 0) counters.sick_days++;
    else if (type === 'holiday' && dueMinutes > 0) counters.holidays++;
    else if (type === 'business-trip') counters.business_trip++;
    else if (type === 'child-sick' && dueMinutes > 0) counters.child_sick++;
    else if (type === 'homeoffice') counters.homeoffice++;

    // if no due minutes and type is sick, holiday, or child-sick continue without adding worked minutes
    if (['sick', 'holiday', 'child-sick'].includes(type) && dueMinutes <= 0) {
      continue;
    }

    // if whole day, add due minutes and continue
    if (duration < 0) {
      worked += dueMinutes;
      continue;
    }
    
    // calculate worked minutes
    const { effectiveStart, effectiveEnd } = range;
    const logStart = dayjs.utc(timelog.start_timestamp);
    const logEnd = timelog.end_timestamp ? dayjs.utc(timelog.end_timestamp) : dayjs.utc();
    const dayEnd = dayjs.utc(date).tz(logTimezone).endOf('day');
    const totalDuration = duration;
    const actualDuration = logEnd.diff(logStart, 'minute');
    
    // Determine if this log had breaks applied (duration < actual time range)
    const breaksWereApplied = totalDuration < actualDuration;
    
    // If log ends after this day, use full effective range
    let effectiveMinutes = effectiveEnd.diff(effectiveStart, 'minute');

    // If log ends within this day, adjust based on breaks
    if (logEnd.isBefore(dayEnd) && breaksWereApplied) {
      effectiveMinutes -= (actualDuration - totalDuration);
    }
    
    worked += effectiveMinutes;
  }
  
  return { worked_minutes: Math.max(0, Math.round(worked)), counters };
}

/**
 * Calculate due minutes for a specific date based on target
 * 
 * @param date - The date to calculate for (YYYY-MM-DD)
 * @param target - The target with duration specs
 * @param holidays - Set of holiday dates in YYYY-MM-DD format
 * @returns Due minutes for the date
 */
export function calculateDueMinutes(
  date: string,
  target: Target,
  holidays: Set<string> = new Set()
): number {
  const dateObj = dayjs.utc(date);
  const weekday = dateObj.day(); // 0=Sunday, 6=Saturday
  
  // Find the applicable duration spec for this date
  for (const spec of target.target_specs) {
    const startDate = dayjs.utc(spec.starting_from);
    const endDate = spec.ending_at ? dayjs.utc(spec.ending_at) : null;
    
    // Check if date is within this spec's range
    if (dateObj.isBefore(startDate, 'day')) continue;
    if (endDate && dateObj.isAfter(endDate, 'day')) continue;
    
    // Check if this is a holiday and should be excluded
    if (spec.exclude_holidays && holidays.has(date)) {
      return 0;
    }
    
    // Return the duration for this weekday (0=Sun, 6=Sat)
    return spec.duration_minutes[weekday] || 0;
  }
  
  return 0; // No applicable spec found
}

/**
 * Aggregate daily balances into a monthly balance
 * 
 * @param dailyBalances - Array of daily balances for the month
 * @param previousCumulation - Cumulation from previous month (0 for first month)
 * @returns Aggregated monthly balance data
 */
export function aggregateToMonthly(
  dailyBalances: Balance[],
  previousCumulation: number = 0
): Omit<Balance, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> {
  if (dailyBalances.length === 0) {
    throw new Error('Cannot aggregate empty daily balances array');
  }
  
  const first = dailyBalances[0];
  let totalDue = 0;
  let totalWorked = 0;
  const counters: Omit<WholeDayCounters, 'normal'> = {
    sick_days: 0,
    holidays: 0,
    business_trip: 0,
    child_sick: 0,
    homeoffice: 0,
  };
  let workedDays = 0;
  
  for (const daily of dailyBalances) {
    totalDue += daily.due_minutes;
    totalWorked += daily.worked_minutes;
    counters.sick_days += daily.sick_days;
    counters.holidays += daily.holidays;
    counters.business_trip += daily.business_trip;
    counters.child_sick += daily.child_sick;
    counters.homeoffice += daily.homeoffice;
    
    // Note: worked_minutes already includes due_minutes for whole_day entries
    // (added in calculateBalanceData), so we do NOT add them again here
    
    // Count worked days (excluding certain special types, excluding business trips)
    if (daily.worked_minutes > 0 && daily.business_trip === 0) {
      workedDays++;
    }
  }
  
  const cumulation = previousCumulation;
  
  // Extract year-month from first daily balance date
  const date = first.date.substring(0, 7); // 'YYYY-MM'
  
  return {
    user_id: first.user_id,
    target_id: first.target_id,
    date,
    due_minutes: totalDue,
    worked_minutes: totalWorked,
    cumulative_minutes: cumulation,
    ...counters,
    worked_days: workedDays,
  };
}

/**
 * Aggregate monthly balances into a yearly balance
 * 
 * @param monthlyBalances - Array of monthly balances for the year (sorted by date)
 * @param previousCumulation - Cumulation from previous year (0 for first year)
 * @returns Aggregated yearly balance data
 */
export function aggregateToYearly(
  monthlyBalances: Balance[],
  previousCumulation: number = 0
): Omit<Balance, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> {
  if (monthlyBalances.length === 0) {
    throw new Error('Cannot aggregate empty monthly balances array');
  }
  
  const first = monthlyBalances[0];
  let totalDue = 0;
  let totalWorked = 0;
  const counters: Omit<WholeDayCounters, 'normal'> = {
    sick_days: 0,
    holidays: 0,
    business_trip: 0,
    child_sick: 0,
    homeoffice: 0,
  };
  let workedDays = 0;
  
  for (const monthly of monthlyBalances) {
    totalDue += monthly.due_minutes;
    totalWorked += monthly.worked_minutes;
    counters.sick_days += monthly.sick_days;
    counters.holidays += monthly.holidays;
    counters.business_trip += monthly.business_trip;
    counters.child_sick += monthly.child_sick;
    counters.homeoffice += monthly.homeoffice;
    workedDays += monthly.worked_days;
  }
  
  const cumulation = previousCumulation;
  
  // Extract year from first monthly balance date
  const date = first.date.substring(0, 4); // 'YYYY'
  
  return {
    user_id: first.user_id,
    target_id: first.target_id,
    date,
    due_minutes: totalDue,
    worked_minutes: totalWorked,
    cumulative_minutes: cumulation,
    ...counters,
    worked_days: workedDays,
  };
}

/**
 * Propagate cumulative minutes through sorted balances
 * Mutates the cumulative_minutes field of each balance
 * 
 * @param balances - Array of balances sorted by date (ascending)
 * @param initialCumulation - Starting cumulation from previous period (default: 0)
 * @returns Final cumulation value after processing all balances
 */
export function propagateCumulativeMinutes(
  balances: Balance[],
  initialCumulation: number = 0
): number {
  let cumulation = initialCumulation;
  
  for (const balance of balances) {
    // cumulative_minutes is the running total BEFORE adding this balance's contribution
    balance.cumulative_minutes = cumulation;
    // Update running total with this balance's contribution
    cumulation += (balance.worked_minutes - balance.due_minutes);
  }
  
  return cumulation;
}
