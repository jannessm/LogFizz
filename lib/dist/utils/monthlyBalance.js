import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
// Extend dayjs with UTC and timezone plugins
dayjs.extend(utc);
dayjs.extend(timezone);
// Set default timezone to UTC for all operations
dayjs.tz.setDefault('UTC');
/**
 * Calculate total worked minutes from time logs
 * Respects auto_subtract_breaks flag if provided
 * Break calculation: 30 mins after 6h, 45 mins after 9h
 *
 * @param timeLogs - Array of time logs with timestamps and types
 * @param rawData - Optional array of raw data containing auto_subtract_breaks flag
 * @returns Total worked minutes (rounded)
 */
export function calculateWorkedMinutes(timeLogs, rawData) {
    let totalMinutes = 0;
    let lastStart = null;
    let lastStartRaw = null;
    for (let i = 0; i < timeLogs.length; i++) {
        const log = timeLogs[i];
        const raw = rawData ? rawData[i] : null;
        if (log.type === 'start') {
            lastStart = log;
            lastStartRaw = raw;
        }
        else if (log.type === 'stop' && lastStart) {
            const startTime = dayjs(lastStart.timestamp);
            const stopTime = dayjs(log.timestamp);
            let minutes = stopTime.diff(startTime, 'minute', true);
            // Apply break subtraction if auto_subtract_breaks is enabled for the button
            const autoSubtractBreaks = lastStartRaw?.auto_subtract_breaks ?? false;
            if (autoSubtractBreaks && minutes > 0) {
                // German break rules: 30 min after 6h, additional 15 min (total 45) after 9h
                if (minutes >= 9 * 60) {
                    minutes -= 45; // 45 minutes break for 9+ hours
                }
                else if (minutes >= 6 * 60) {
                    minutes -= 30; // 30 minutes break for 6-9 hours
                }
            }
            totalMinutes += Math.max(0, minutes);
            lastStart = null;
            lastStartRaw = null;
        }
    }
    return Math.round(totalMinutes);
}
/**
 * Calculate due minutes based on target and month
 * Respects starting_from date - only counts days on or after starting_from
 *
 * @param target - Daily target with weekdays, duration_minutes, and starting_from
 * @param year - Year (e.g., 2025)
 * @param month - Month (1-12)
 * @param holidays - Set of holiday dates in YYYY-MM-DD format to exclude
 * @returns Total due minutes for the month
 */
export function calculateDueMinutes(target, year, month, holidays = new Set()) {
    let totalMinutes = 0;
    // Get starting_from date if set
    const startingFrom = target.starting_from ? dayjs(target.starting_from).utc() : null;
    // Iterate through each day of the month using dayjs
    const monthStart = dayjs.utc(`${year}-${month.toString().padStart(2, '0')}-01`);
    const daysInMonth = monthStart.daysInMonth();
    for (let day = 1; day <= daysInMonth; day++) {
        const date = monthStart.date(day);
        const dayOfWeek = date.day(); // 0=Sunday, 6=Saturday
        const dateString = date.format('YYYY-MM-DD');
        // Skip days before starting_from
        if (startingFrom && date.isBefore(startingFrom, 'day')) {
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
 * @param timeLogs - Array of time logs with timestamps
 * @returns Earliest affected month as dayjs object, or null if no logs
 */
export function getEarliestAffectedMonth(timeLogs) {
    if (timeLogs.length === 0) {
        return null;
    }
    let earliestDate = null;
    for (const log of timeLogs) {
        const date = dayjs(log.timestamp).utc().startOf('month');
        if (!earliestDate || date.isBefore(earliestDate)) {
            earliestDate = date;
        }
    }
    return earliestDate;
}
//# sourceMappingURL=monthlyBalance.js.map