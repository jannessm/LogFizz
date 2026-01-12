import { writable } from 'svelte/store';
import { getSetting, saveSetting } from '../lib/db';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeStore {
  mode: ThemeMode;
  effectiveTheme: 'light' | 'dark';
}

function createThemeStore() {
  const { subscribe, set, update } = writable<ThemeStore>({
    mode: 'auto',
    effectiveTheme: 'light'
  });

  // Listen for system theme changes
  const mediaQuery = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function getSystemTheme(): 'light' | 'dark' {
    if (mediaQuery?.matches) {
      return 'dark';
    }
    return 'light';
  }

  function updateEffectiveTheme(mode: ThemeMode) {
    const effectiveTheme = mode === 'auto' ? getSystemTheme() : mode;
    update(state => ({ ...state, effectiveTheme }));
    
    // Apply theme to document
    if (typeof document !== 'undefined') {
      if (effectiveTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }

  // Listen for system theme changes
  if (mediaQuery) {
    mediaQuery.addEventListener('change', (e) => {
      update(state => {
        if (state.mode === 'auto') {
          const effectiveTheme = e.matches ? 'dark' : 'light';
          
          // Apply theme to document
          if (typeof document !== 'undefined') {
            if (effectiveTheme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }
          
          return { ...state, effectiveTheme };
        }
        return state;
      });
    });
  }

  return {
    subscribe,
    async init() {
      const savedMode = await getSetting('themeMode') as ThemeMode | undefined;
      const mode = savedMode || 'auto';
      set({ mode, effectiveTheme: mode === 'auto' ? getSystemTheme() : mode });
      updateEffectiveTheme(mode);
    },
    async setMode(mode: ThemeMode) {
      await saveSetting('themeMode', mode);
      update(state => ({ ...state, mode }));
      updateEffectiveTheme(mode);
    }
  };
}

export const themeStore = createThemeStore();
