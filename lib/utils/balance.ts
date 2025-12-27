/**
 * Balance Calculation Utilities
 * 
 * This module implements the balance calculation logic as specified in docs/balances.md
 * All balances are calculated bottom-up: Daily -> Monthly -> Yearly
 */

import dayjs from './dayjs.js';
import type { TimeLog, TargetSpec, Balance as BaseBalance } from '../types/index.js';

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
 * Counters for special timelog types
 */
export interface SpecialDayCounters {
  sick_days: number;
  holidays: number;
  business_trip: number;
  child_sick: number;
}

/**
 * Result of calculating worked minutes for a specific date
 */
export interface WorkedCalculation {
  worked_minutes: number;
  counters: SpecialDayCounters;
}

/**
 * Get the effective date range for a timelog within a specific day
 * Clips the timelog's start/end to the day boundaries
 * 
 * @param date - The date to calculate for (YYYY-MM-DD)
 * @param start - Timelog start timestamp
 * @param end - Timelog end timestamp (optional for running timelogs)
 * @returns Effective start and end times clipped to the day
 */
export function getEffectiveRange(
  date: string,
  start: string,
  end?: string | null
): { effectiveStart: dayjs.Dayjs; effectiveEnd: dayjs.Dayjs } | null {
  const dayStart = dayjs(date).startOf('day');
  const dayEnd = dayjs(date).endOf('day');
  
  const logStart = dayjs(start);
  const logEnd = end ? dayjs(end) : dayjs(); // Use current time for running logs
  
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
  
  // If duration is already calculated, use it
  if (timelog.duration_minutes !== undefined && timelog.duration_minutes !== null) {
    return timelog.duration_minutes;
  }
  
  // Calculate from timestamps
  if (!timelog.start_timestamp || !timelog.end_timestamp) {
    return 0;
  }
  
  const start = dayjs(timelog.start_timestamp);
  const end = dayjs(timelog.end_timestamp);
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
 * @returns Worked minutes and counters for special day types
 */
export function calculateWorkedMinutesForDate(
  date: string,
  timelogs: TimeLog[]
): WorkedCalculation {
  let worked = 0;
  const counters: SpecialDayCounters = {
    sick_days: 0,
    holidays: 0,
    business_trip: 0,
    child_sick: 0,
  };
  
  for (const timelog of timelogs) {
    const duration = calculateTimelogDuration(timelog);
    
    // Whole day entries (duration < 0) only increment counters
    if (duration < 0) {
      const type = timelog.type || 'normal';
      if (type === 'sick') counters.sick_days++;
      else if (type === 'holiday') counters.holidays++;
      else if (type === 'business-trip') counters.business_trip++;
      else if (type === 'child-sick') counters.child_sick++;
      continue;
    }
    
    // Get effective range for this date
    const range = getEffectiveRange(date, timelog.start_timestamp, timelog.end_timestamp);
    if (!range) continue; // Timelog doesn't overlap with this date
    
    const { effectiveStart, effectiveEnd } = range;
    let effectiveMinutes = effectiveEnd.diff(effectiveStart, 'minute');
    
    // Check if breaks were already subtracted
    // Breaks are only applied once on the last day and only if log ends before day end
    const logEnd = timelog.end_timestamp ? dayjs(timelog.end_timestamp) : dayjs();
    const dayEnd = dayjs(date).endOf('day');
    const totalDuration = duration;
    const actualDuration = logEnd.diff(dayjs(timelog.start_timestamp), 'minute');
    
    // If timelog.duration < actual timerange AND log ends before day end, breaks were applied
    if (totalDuration < actualDuration && logEnd.isBefore(dayEnd)) {
      // Add back the difference (the break that was subtracted)
      effectiveMinutes += (actualDuration - totalDuration);
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
  const dateObj = dayjs(date);
  const weekday = dateObj.day(); // 0=Sunday, 6=Saturday
  
  // Find the applicable duration spec for this date
  for (const spec of target.target_specs) {
    const startDate = dayjs(spec.starting_from);
    const endDate = spec.ending_at ? dayjs(spec.ending_at) : null;
    
    // Check if date is within this spec's range
    if (dateObj.isBefore(startDate, 'day')) continue;
    if (endDate && dateObj.isAfter(endDate, 'day')) continue;
    
    // Check if this is a holiday and should be excluded
    if (spec.exclude_holidays && holidays.has(date)) {
      return 0;
    }
    
    // Check if this weekday is in the target weekdays
    const weekdayIndex = spec.weekdays.indexOf(weekday);
    if (weekdayIndex === -1) {
      return 0; // Not a work day
    }
    
    // Return the duration for this weekday
    return spec.duration_minutes[weekdayIndex] || 0;
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
  const counters: SpecialDayCounters = {
    sick_days: 0,
    holidays: 0,
    business_trip: 0,
    child_sick: 0,
  };
  let workedDays = 0;
  
  for (const daily of dailyBalances) {
    totalDue += daily.due_minutes;
    totalWorked += daily.worked_minutes;
    counters.sick_days += daily.sick_days;
    counters.holidays += daily.holidays;
    counters.business_trip += daily.business_trip;
    counters.child_sick += daily.child_sick;
    
    // For special types, add due minutes to worked minutes
    if (daily.sick_days > 0) totalWorked += daily.due_minutes;
    if (daily.holidays > 0) totalWorked += daily.due_minutes;
    if (daily.business_trip > 0) totalWorked += daily.due_minutes;
    if (daily.child_sick > 0) totalWorked += daily.due_minutes;
    
    // Count worked days (excluding certain special types, excluding business trips)
    if (daily.worked_minutes > 0 && daily.business_trip === 0) {
      workedDays++;
    }
  }
  
  const cumulation = totalWorked - totalDue + previousCumulation;
  
  // Extract year-month from first daily balance date
  const date = first.date.substring(0, 7); // 'YYYY-MM'
  
  return {
    user_id: first.user_id,
    target_id: first.target_id,
    next_balance_id: null,
    parent_balance_id: null, // Will be set by caller
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
  const counters: SpecialDayCounters = {
    sick_days: 0,
    holidays: 0,
    business_trip: 0,
    child_sick: 0,
  };
  let workedDays = 0;
  
  for (const monthly of monthlyBalances) {
    totalDue += monthly.due_minutes;
    totalWorked += monthly.worked_minutes;
    counters.sick_days += monthly.sick_days;
    counters.holidays += monthly.holidays;
    counters.business_trip += monthly.business_trip;
    counters.child_sick += monthly.child_sick;
    workedDays += monthly.worked_days;
  }
  
  const cumulation = totalWorked - totalDue + previousCumulation;
  
  // Extract year from first monthly balance date
  const date = first.date.substring(0, 4); // 'YYYY'
  
  return {
    user_id: first.user_id,
    target_id: first.target_id,
    next_balance_id: null,
    parent_balance_id: null, // Will be set by caller
    date,
    due_minutes: totalDue,
    worked_minutes: totalWorked,
    cumulative_minutes: cumulation,
    ...counters,
    worked_days: workedDays,
  };
}
