import { writable, get } from 'svelte/store';
import type { UserSettings } from '../types';
import { userSettingsApi } from '../services/api';
import { saveSetting, getSetting } from '../lib/db';

interface UserSettingsStore {
  settings: UserSettings | null;
  isLoading: boolean;
  error: string | null;
}

const USER_SETTINGS_KEY = 'user_settings';
const USER_SETTINGS_CURSOR_KEY = 'user_settings_sync_cursor';

function createUserSettingsStore() {
  const { subscribe, set, update } = writable<UserSettingsStore>({
    settings: null,
    isLoading: true,
    error: null,
  });

  return {
    subscribe,

    /**
     * Initialize the store - load from local storage and sync with server
     */
    async init() {
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
              error: null
            }));
          } catch (error: any) {
            // If fetch fails, keep local settings
            console.warn('Failed to fetch user settings from server:', error);
            if (!localSettings) {
              update(state => ({ 
                ...state, 
                isLoading: false 
              }));
            }
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
      }
    },

    /**
     * Update user settings
     */
    async updateSettings(updates: { language?: string; locale?: string }) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const currentState = get({ subscribe });
        const updatedSettings = {
          ...currentState.settings,
          ...updates,
          updated_at: new Date().toISOString(),
        } as UserSettings;

        // Save to local storage immediately
        await saveSetting(USER_SETTINGS_KEY, updatedSettings);
        update(state => ({ 
          ...state, 
          settings: updatedSettings,
        }));

        // Sync to server if online
        if (navigator.onLine) {
          try {
            const settings = await userSettingsApi.updateSettings(updates);
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
        error: null,
      });
    },
  };
}

export const userSettingsStore = createUserSettingsStore();
