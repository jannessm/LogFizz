/**
 * Format minutes as hours and minutes with sign
 * Example: 150 -> "+2h 30m", -90 -> "-1h 30m"
 *
 * @param minutes - Number of minutes (can be negative)
 * @returns Formatted string with sign, hours, and minutes
 */
export declare function formatMinutes(minutes: number): string;
/**
 * Format minutes as hours and minutes (compact, no sign)
 * Example: 150 -> "2h 30m", 90 -> "1h 30m", 30 -> "30m", 60 -> "1h"
 *
 * @param minutes - Number of minutes
 * @returns Formatted string as hours and/or minutes
 */
export declare function formatMinutesCompact(minutes: number): string;
/**
 * Format minutes as hours with one decimal place
 * Example: 150 -> "2.5h", 90 -> "1.5h"
 *
 * @param minutes - Number of minutes
 * @returns Formatted string as hours with one decimal place
 */
export declare function formatHours(minutes: number): string;
/**
 * Format seconds as HH:MM:SS
 * Example: 3661 -> "01:01:01", 90 -> "00:01:30"
 *
 * @param seconds - Number of seconds
 * @param includeSeconds - Whether to include seconds in output (default: true)
 * @returns Formatted string as HH:MM:SS or HH:MM
 */
export declare function formatTime(seconds: number, includeSeconds?: boolean): string;
/**
 * Get color class for balance display based on value
 *
 * @param balanceMinutes - Balance in minutes
 * @returns Tailwind CSS color class
 */
export declare function getBalanceColor(balanceMinutes: number): string;
//# sourceMappingURL=timeFormat.d.ts.map