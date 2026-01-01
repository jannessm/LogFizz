/**
 * Utility functions for working with TargetWithSpecs
 */
import type { TargetWithSpecs, TargetSpec } from '../../types';
import dayjs from '../../../../lib/utils/dayjs.js';

/**
 * Get the active TargetSpec for a given date
 * Returns the spec that is valid for the given date (within starting_from and ending_at)
 * If multiple specs match, returns the most recent one
 * 
 * @param target - Target with nested target_specs
 * @param date - Date to check (defaults to today)
 * @returns Active TargetSpec or undefined if none found
 */
export function getActiveTargetSpec(target: TargetWithSpecs, date: Date | string = new Date()): TargetSpec | undefined {
  const checkDate = dayjs(date);
  
  const activeSpecs = (target.target_specs || []).filter(spec => {
    const startDate = dayjs(spec.starting_from);
    const endDate = spec.ending_at ? dayjs(spec.ending_at) : null;
    
    if (checkDate.isBefore(startDate, 'day')) return false;
    if (endDate && checkDate.isAfter(endDate, 'day')) return false;
    
    return true;
  });
  
  // Return the most recent spec (sort by starting_from descending)
  if (activeSpecs.length === 0) return undefined;
  
  activeSpecs.sort((a, b) => {
    return dayjs(b.starting_from).diff(dayjs(a.starting_from));
  });
  
  return activeSpecs[0];
}

/**
 * Get the latest TargetSpec (by ending_at date)
 * Used for checking if a target has ended
 * 
 * @param target - Target with nested target_specs
 * @returns Latest TargetSpec or undefined if none found
 */
export function getLatestTargetSpec(target: TargetWithSpecs): TargetSpec | undefined {
  if (!target.target_specs || target.target_specs.length === 0) return undefined;
  
  const specsWithEnd = target.target_specs.filter(s => s.ending_at);
  if (specsWithEnd.length === 0) {
    // If no specs have ending_at, return the most recent by starting_from
    const sorted = [...target.target_specs].sort((a, b) => {
      return dayjs(b.starting_from).diff(dayjs(a.starting_from));
    });
    return sorted[0];
  }
  
  // Return the spec with the latest ending_at
  const sorted = [...specsWithEnd].sort((a, b) => {
    return dayjs(b.ending_at!).diff(dayjs(a.ending_at!));
  });
  
  return sorted[0];
}

/**
 * Check if a target is archived (has an ending_at date set)
 * 
 * @param target - Target with nested target_specs
 * @returns true if target is archived (has ending_at), false otherwise
 */
export function isTargetArchived(target: TargetWithSpecs): boolean {
  if (!target.target_specs || target.target_specs.length === 0) return false;
  
  // Check if the most recent spec (by starting_from) has an ending_at
  const sorted = [...target.target_specs].sort((a, b) => {
    return dayjs(b.starting_from).diff(dayjs(a.starting_from));
  });
  
  return sorted[0]?.ending_at !== undefined;
}

/**
 * Check if a target has ended (all specs have ending_at in the past)
 * 
 * @param target - Target with nested target_specs
 * @returns true if target has ended, false otherwise
 */
export function isTargetEnded(target: TargetWithSpecs): boolean {
  const latestSpec = getLatestTargetSpec(target);
  if (!latestSpec || !latestSpec.ending_at) return false;
  
  return dayjs(latestSpec.ending_at).isBefore(dayjs(), 'day');
}

/**
 * Get weekday names for display
 * 
 * @param weekdays - Array of weekday numbers (0=Sun, 6=Sat)
 * @returns Comma-separated string of weekday abbreviations
 */
export function getWeekdayNames(weekdays: number[]): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekdays.map(d => dayNames[d]).join(', ');
}
