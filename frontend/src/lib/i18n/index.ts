import { register, init, getLocaleFromNavigator, locale, _ } from 'svelte-i18n';
import { get } from 'svelte/store';

// Register the translations
register('en', () => import('./en.json'));
register('de', () => import('./de.json'));

// Initialize i18n
export function initI18n(initialLocale?: string) {
  init({
    fallbackLocale: 'en',
    initialLocale: initialLocale || getLocaleFromNavigator()?.split('-')[0] || 'en',
  });
}

// Re-export for convenience
export { locale, _ };

// Export function to change locale
export function setLocale(lang: string) {
  locale.set(lang);
}

// Get the current locale
export function getLocale(): string {
  return get(locale) || 'en';
}
