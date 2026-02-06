import dayjs from 'dayjs';
import 'dayjs/locale/de';
import 'dayjs/locale/en';
import LocalizedFormat from 'dayjs/plugin/localizedFormat';

import en from './en.json';
import de from './de.json';

// Extend dayjs with localized format plugin
dayjs.extend(LocalizedFormat);

type TranslationData = typeof en;

const translations: Record<string, TranslationData> = {
  en,
  de,
};

// Map user locale settings to backend language codes
const localeToLanguage: Record<string, string> = {
  'en-US': 'en',
  'en-GB': 'en',
  'de-DE': 'de',
  'de-AT': 'de',
  'de-CH': 'de',
};

// Map user locale settings to dayjs locale codes
const localeToDayjsLocale: Record<string, string> = {
  'en-US': 'en',
  'en-GB': 'en',
  'de-DE': 'de',
  'de-AT': 'de',
  'de-CH': 'de',
};

/**
 * Get the language code from a locale string
 */
export function getLanguageFromLocale(locale: string): string {
  return localeToLanguage[locale] || locale.split('-')[0] || 'en';
}

/**
 * Get a nested translation value by key path
 * @param obj - The translation object
 * @param path - The key path (e.g., 'auth.invalidCredentials')
 * @returns The translation string or undefined
 */
function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Translate a key to the specified language
 * @param key - The translation key (e.g., 'auth.invalidCredentials')
 * @param language - The language code ('en' or 'de')
 * @param params - Optional parameters to interpolate into the string
 * @returns The translated string
 */
export function t(key: string, language: string = 'en', params?: Record<string, string | number>): string {
  const lang = language in translations ? language : 'en';
  let text = getNestedValue(translations[lang], key);
  
  // Fallback to English if translation not found
  if (!text && lang !== 'en') {
    text = getNestedValue(translations['en'], key);
  }
  
  // If still not found, return the key
  if (!text) {
    return key;
  }
  
  // Interpolate parameters
  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text!.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
    });
  }
  
  return text;
}

/**
 * Format a date according to the user's locale
 * @param date - The date to format
 * @param locale - The user's locale (e.g., 'de-DE', 'en-US')
 * @param formatKey - The format key from dateFormat translations (e.g., 'fullDate', 'shortDate')
 * @returns The formatted date string
 */
export function formatDateLocale(
  date: string | Date | dayjs.Dayjs,
  locale: string = 'en-US',
  formatKey: 'fullDate' | 'shortDate' | 'dateTime' | 'time' = 'fullDate'
): string {
  const dayjsLocale = localeToDayjsLocale[locale] || 'en';
  const language = getLanguageFromLocale(locale);
  const format = t(`dateFormat.${formatKey}`, language);
  
  return dayjs(date).locale(dayjsLocale).format(format);
}

/**
 * Format a date using dayjs localized format tokens
 * @param date - The date to format
 * @param locale - The user's locale
 * @param format - The dayjs format string (e.g., 'L', 'LL', 'LT')
 * @returns The formatted date string
 */
export function formatDateDayjs(
  date: string | Date | dayjs.Dayjs,
  locale: string = 'en-US',
  format: string = 'LL'
): string {
  const dayjsLocale = localeToDayjsLocale[locale] || 'en';
  return dayjs(date).locale(dayjsLocale).format(format);
}

/**
 * Create a translator function bound to a specific language
 * @param language - The language code
 * @returns A translation function
 */
export function createTranslator(language: string) {
  return (key: string, params?: Record<string, string | number>) => t(key, language, params);
}

/**
 * Create a translator function from a user's locale
 * @param locale - The user's locale (e.g., 'de-DE', 'en-US')
 * @returns A translation function
 */
export function createTranslatorFromLocale(locale: string) {
  const language = getLanguageFromLocale(locale);
  return createTranslator(language);
}
