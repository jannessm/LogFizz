import { writable, get } from 'svelte/store';
import type { UserSettings } from '../types';
import { userSettingsApi } from '../services/api';
import { saveSetting, getSetting } from '../lib/db';

interface UserSettingsStore {
  settings: UserSettings | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

const USER_SETTINGS_KEY = 'user_settings';
const USER_SETTINGS_CURSOR_KEY = 'user_settings_sync_cursor';

function createUserSettingsStore() {
  const { subscribe, set, update } = writable<UserSettingsStore>({
    settings: null,
    isLoading: true,
    isInitialized: false,
    error: null,
  });

  let initPromise: Promise<void> | null = null;

  return {
    subscribe,

    /**
     * Initialize the store - load from local storage and sync with server
     * Idempotent - will not re-initialize if already initialized
     */
    async init() {
      const currentState = get({ subscribe });
      
      // If already initialized, return immediately
      if (currentState.isInitialized) {
        return;
      }

      // If initialization is in progress, wait for it
      if (initPromise) {
        return initPromise;
      }

      initPromise = (async () => {
        update(state => ({ ...state, isLoading: true }));
        try {
          // Try to load from local storage first
          const localSettings = await getSetting(USER_SETTINGS_KEY);
          if (localSettings) {
            update(state => ({ 
              ...state, 
              settings: localSettings,
              isLoading: false 
            }));
          }

          // Try to fetch from API if online
          if (navigator.onLine) {
            try {
              const settings = await userSettingsApi.getSettings();
              await saveSetting(USER_SETTINGS_KEY, settings);
              update(state => ({ 
                ...state, 
                settings, 
                isLoading: false,
                isInitialized: true,
                error: null
              }));
            } catch (error: any) {
              // If fetch fails, keep local settings
              console.warn('Failed to fetch user settings from server:', error);
              update(state => ({ 
                ...state, 
                isLoading: false,
                isInitialized: true
              }));
            }
          } else {
            update(state => ({ ...state, isLoading: false, isInitialized: true }));
          }
        } catch (error: any) {
          update(state => ({ 
            ...state, 
            error: error.message,
            isLoading: false,
            isInitialized: true
          }));
        } finally {
          initPromise = null;
        }
      })();

      return initPromise;
    },

    /**
     * Update user settings
     */
    async updateSettings(updates: { language?: string; locale?: string; first_day_of_week?: 'sunday' | 'monday'; statistics_email_frequency?: 'none' | 'weekly' | 'monthly' }) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const currentState = get({ subscribe });
        // Create optimistic update without manually setting timestamp
        const optimisticSettings = {
          ...currentState.settings,
          ...updates,
        } as UserSettings;

        // Save to local storage immediately for optimistic update
        await saveSetting(USER_SETTINGS_KEY, optimisticSettings);
        update(state => ({ 
          ...state, 
          settings: optimisticSettings,
        }));

        // Sync to server if online
        if (navigator.onLine) {
          try {
            const settings = await userSettingsApi.updateSettings(updates);
            // Use server-returned settings with authoritative timestamp
            await saveSetting(USER_SETTINGS_KEY, settings);
            update(state => ({ 
              ...state, 
              settings,
              isLoading: false 
            }));
          } catch (error: any) {
            console.warn('Failed to sync settings to server:', error);
            update(state => ({ ...state, isLoading: false }));
          }
        } else {
          update(state => ({ ...state, isLoading: false }));
        }
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },

    /**
     * Get current language
     */
    getLanguage(): string {
      const state = get({ subscribe });
      return state.settings?.language || 'en';
    },

    /**
     * Get current locale
     */
    getLocale(): string {
      const state = get({ subscribe });
      return state.settings?.locale || 'en-US';
    },

    /**
     * Clear settings (used on logout)
     */
    async clear() {
      await saveSetting(USER_SETTINGS_KEY, null);
      await saveSetting(USER_SETTINGS_CURSOR_KEY, null);
      set({
        settings: null,
        isLoading: false,
        isInitialized: false,
        error: null,
      });
    },

    setupDone() {
      const state = get({ subscribe });
      const settings = state.settings;
      return !!(settings?.language &&
                settings?.locale &&
                settings?.first_day_of_week);
    }
  };
}

export const userSettingsStore = createUserSettingsStore();
