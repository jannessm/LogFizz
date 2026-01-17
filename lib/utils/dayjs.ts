import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
import weekOfYear from 'dayjs/plugin/weekOfYear.js';
import LocalizedFormat from 'dayjs/plugin/localizedFormat.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

// Extend dayjs with UTC and timezone plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(weekOfYear);
dayjs.extend(LocalizedFormat);
dayjs.extend(customParseFormat);

// Set default timezone to UTC for all operations
dayjs.tz.setDefault('UTC');

// get user's timezone if needed
export const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Configured dayjs instance with UTC plugin
 * Use this throughout the backend for consistent date/time handling
 * 
 * Common usage patterns:
 * - dayjs() - current time in UTC
 * - dayjs(date) - parse a date
 * - dayjs.utc(date) - explicitly create UTC date
 * - dayjs().format() - format as ISO string
 * - dayjs().toDate() - convert to native Date object when needed for TypeORM
 */
export default dayjs;

export { dayjs };