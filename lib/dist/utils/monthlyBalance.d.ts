import dayjs from 'dayjs';
export interface TimeLog {
    start_timestamp: Date;
    end_timestamp?: Date;
    duration_minutes?: number;
}
export interface TimeLogWithButton extends TimeLog {
    auto_subtract_breaks?: boolean;
}
export interface DailyTarget {
    weekdays: number[];
    duration_minutes: number[];
    starting_from?: Date | null;
    ending_at?: Date | null;
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
export declare function calculateWorkedMinutes(timeLogs: TimeLog[], rawData?: Array<{
    auto_subtract_breaks?: boolean;
}>): number;
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
export declare function calculateDueMinutes(target: DailyTarget, year: number, month: number, holidays?: Set<string>): number;
/**
 * Get affected months from a list of time logs
 * Returns the earliest month that should be recalculated
 *
 * @param timeLogs - Array of time logs with start_timestamp
 * @returns Earliest affected month as dayjs object, or null if no logs
 */
export declare function getEarliestAffectedMonth(timeLogs: Array<{
    start_timestamp: Date;
}>): dayjs.Dayjs | null;
//# sourceMappingURL=monthlyBalance.d.ts.map