/**
 * Format minutes as hours and minutes with sign
 * Example: 150 -> "+2h 30m", -90 -> "-1h 30m"
 *
 * @param minutes - Number of minutes (can be negative)
 * @returns Formatted string with sign, hours, and minutes
 */
export function formatMinutes(minutes) {
    if (!isFinite(minutes) || isNaN(minutes)) {
        return '+0h 0m';
    }
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? '-' : '+';
    return `${sign}${hours}h ${mins}m`;
}
/**
 * Format minutes as hours and minutes (compact, no sign)
 * Example: 150 -> "2h 30m", 90 -> "1h 30m", 30 -> "30m", 60 -> "1h"
 *
 * @param minutes - Number of minutes
 * @returns Formatted string as hours and/or minutes
 */
export function formatMinutesCompact(minutes) {
    if (!isFinite(minutes) || isNaN(minutes)) {
        return '0m';
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0)
        return `${mins}m`;
    if (mins === 0)
        return `${hours}h`;
    return `${hours}h ${mins}m`;
}
/**
 * Format minutes as hours with one decimal place
 * Example: 150 -> "2.5h", 90 -> "1.5h"
 *
 * @param minutes - Number of minutes
 * @returns Formatted string as hours with one decimal place
 */
export function formatHours(minutes) {
    if (!isFinite(minutes) || isNaN(minutes)) {
        return '0.0h';
    }
    const hours = (minutes / 60).toFixed(1);
    return `${hours}h`;
}
/**
 * Format seconds as HH:MM:SS
 * Example: 3661 -> "01:01:01", 90 -> "00:01:30"
 *
 * @param seconds - Number of seconds
 * @param includeSeconds - Whether to include seconds in output (default: true)
 * @returns Formatted string as HH:MM:SS or HH:MM
 */
export function formatTime(seconds, includeSeconds = true) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (!includeSeconds) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
/**
 * Get color class for balance display based on value
 *
 * @param balanceMinutes - Balance in minutes
 * @returns Tailwind CSS color class
 */
export function getBalanceColor(balanceMinutes) {
    if (balanceMinutes > 0)
        return 'text-green-600';
    if (balanceMinutes < 0)
        return 'text-red-600';
    return 'text-gray-600';
}
//# sourceMappingURL=timeFormat.js.map