import { dayjs } from '../types';
import 'dayjs/locale/de';
import 'dayjs/locale/en';
import 'dayjs/locale/en-gb';
import { writable } from 'svelte/store';
import { userSettingsStore } from '../stores/userSettings';

// Map locale codes to dayjs locale names
const localeMap: Record<string, string> = {
  'en-US': 'en',
  'en-GB': 'en-gb',
  'de-DE': 'de',
};

// Store for the current dayjs locale
export const currentLocale = writable<string>('en');

/**
 * Update the dayjs global locale based on user settings
 */
export function setDayjsLocale(locale: string) {
  const dayjsLocale = localeMap[locale] || 'en';
  console.log(`Setting dayjs locale from ${locale} to ${dayjsLocale}`);
  
  // Set the global locale
  dayjs.locale(dayjsLocale);
  
  // Update the store
  currentLocale.set(dayjsLocale);
  
  // Verify it was set correctly
  const currentDayjsLocale = dayjs.locale();
  console.log(`Current dayjs locale is now: ${currentDayjsLocale}`);
  
  return currentDayjsLocale;
}

/**
 * Initialize dayjs locale from user settings store
 */
export function initLocaleFromSettings() {
  const locale = userSettingsStore.getLocale();
  setDayjsLocale(locale);
}

/**
 * Format a date using locale-aware format
 * Uses dayjs localized format tokens (L, LL, LT, etc.)
 * 
 * @param date - Date to format (string, Date, or dayjs)
 * @param format - Format pattern (supports locale tokens like 'L', 'LL', 'LT')
 * @returns Formatted date string
 */
export function formatDate(date: string | Date | dayjs.Dayjs, format: string = 'L'): string {
  return dayjs(date).format(format);
}

/**
 * Format date and time using locale-aware format
 * @param date - Date to format
 * @returns Formatted date and time string (e.g., "01/15/2025 3:30 PM" or "15.01.2025 15:30")
 */
export function formatDateTime(date: string | Date | dayjs.Dayjs): string {
  return dayjs(date).format('L LT');
}

/**
 * Format time only using locale-aware format
 * @param date - Date to format
 * @returns Formatted time string (e.g., "3:30 PM" or "15:30")
 */
export function formatTime(date: string | Date | dayjs.Dayjs): string {
  return dayjs(date).format('LT');
}

/**
 * Format full date with day name using locale-aware format
 * @param date - Date to format
 * @returns Formatted date with day name (e.g., "Wednesday, January 15, 2025")
 */
export function formatFullDate(date: string | Date | dayjs.Dayjs): string {
  return dayjs(date).format('dddd, LL');
}

/**
 * Format month and year using locale-aware format
 * @param date - Date to format
 * @returns Formatted month and year (e.g., "January 2025" or "Januar 2025")
 */
export function formatMonthYear(date: string | Date | dayjs.Dayjs): string {
  return dayjs(date).format('MMMM YYYY');
}

/**
 * Format short date using locale-aware format
 * @param date - Date to format
 * @returns Short formatted date (e.g., "Jan 15" or "15. Jan")
 */
export function formatShortDate(date: string | Date | dayjs.Dayjs): string {
  return dayjs(date).format('MMM D');
}

/**
 * Format short date with year using locale-aware format
 * @param date - Date to format
 * @returns Short formatted date with year (e.g., "Jan 15, 2025" or "15. Jan 2025")
 */
export function formatShortDateYear(date: string | Date | dayjs.Dayjs): string {
  return dayjs(date).format('ll');
}

/**
 * Detect whether the current locale uses a 12-hour clock (AM/PM).
 * Checks by formatting a known PM time with the locale-aware 'LT' token
 * and looking for an AM/PM meridiem marker.
 *
 * @returns true if the locale uses 12-hour clock (AM/PM), false for 24-hour clock
 */
export function uses12HourClock(): boolean {
  // Format 13:00 (1 PM) with locale-aware time token and check for meridiem
  const formatted = dayjs().hour(13).minute(0).format('LT');
  return /[aApP][mM]/.test(formatted);
}

/**
 * Get day abbreviation based on language setting
 * Unlike locale-based formatting, this uses the language setting (en/de)
 * to ensure consistent day name abbreviations regardless of locale variant (en-US vs en-GB)
 * 
 * @param dayIndex - Day of week (0=Sunday, 6=Saturday)
 * @param language - Language code ('en' or 'de'). If not provided, uses current user language setting
 * @returns Day abbreviation (e.g., 'Sun', 'Mon' for en; 'So', 'Mo' for de)
 */
export function getDayAbbreviation(dayIndex: number, language?: string): string {
  const lang = language || userSettingsStore.getLanguage();
  // Create a temporary dayjs instance with the language-specific locale
  // This ensures we get day names based on language, not the global locale
  return dayjs().locale(lang).day(dayIndex).format('ddd');
}

/**
 * Get all day abbreviations for a week based on language setting
 * 
 * @param language - Language code ('en' or 'de'). If not provided, uses current user language setting
 * @returns Array of day abbreviations starting from Sunday [Sun, Mon, ..., Sat] or [So, Mo, ..., Sa]
 */
export function getDayAbbreviations(language?: string): string[] {
  return Array.from({ length: 7 }, (_, i) => getDayAbbreviation(i, language));
}
