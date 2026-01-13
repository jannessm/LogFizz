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

  function applyThemeToDocument(theme: 'light' | 'dark') {
    if (typeof document !== 'undefined') {
      console.log('[Theme] Applying theme to document:', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        console.log('[Theme] Dark class added to html element');
      } else {
        document.documentElement.classList.remove('dark');
        console.log('[Theme] Dark class removed from html element');
      }
      console.log('[Theme] Current classes:', document.documentElement.className);
    }
  }

  function updateEffectiveTheme(mode: ThemeMode) {
    const effectiveTheme = mode === 'auto' ? getSystemTheme() : mode;
    update(state => ({ ...state, effectiveTheme }));
    applyThemeToDocument(effectiveTheme);
  }

  // Listen for system theme changes
  if (mediaQuery) {
    mediaQuery.addEventListener('change', (e) => {
      update(state => {
        if (state.mode === 'auto') {
          const effectiveTheme = e.matches ? 'dark' : 'light';
          applyThemeToDocument(effectiveTheme);
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
