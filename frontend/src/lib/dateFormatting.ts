import dayjs from 'dayjs';
import 'dayjs/locale/de';
import 'dayjs/locale/de-at';
import 'dayjs/locale/de-ch';
import 'dayjs/locale/en';
import 'dayjs/locale/en-gb';
import { writable, derived, get } from 'svelte/store';
import { userSettingsStore } from '../stores/userSettings';

// Map locale codes to dayjs locale names
const localeMap: Record<string, string> = {
  'en-US': 'en',
  'en-GB': 'en-gb',
  'de-DE': 'de',
  'de-AT': 'de-at',
  'de-CH': 'de-ch',
};

// Store for the current dayjs locale
export const currentLocale = writable<string>('en');

/**
 * Update the dayjs global locale based on user settings
 */
export function setDayjsLocale(locale: string) {
  const dayjsLocale = localeMap[locale] || 'en';
  dayjs.locale(dayjsLocale);
  currentLocale.set(dayjsLocale);
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
