import { describe, it, expect, beforeEach, vi } from 'vitest';
import { themeStore } from './theme';
import { get } from 'svelte/store';

// Mock the db module
vi.mock('../lib/db', () => ({
  getSetting: vi.fn().mockResolvedValue(null),
  saveSetting: vi.fn().mockResolvedValue(undefined),
}));

describe('themeStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document classes
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark');
    }
  });

  it('initializes with auto mode by default', async () => {
    await themeStore.init();
    const state = get(themeStore);
    expect(state.mode).toBe('auto');
    expect(['light', 'dark']).toContain(state.effectiveTheme);
  });

  it('sets light theme mode', async () => {
    await themeStore.init();
    await themeStore.setMode('light');
    const state = get(themeStore);
    expect(state.mode).toBe('light');
    expect(state.effectiveTheme).toBe('light');
  });

  it('sets dark theme mode', async () => {
    await themeStore.init();
    await themeStore.setMode('dark');
    const state = get(themeStore);
    expect(state.mode).toBe('dark');
    expect(state.effectiveTheme).toBe('dark');
  });

  it('sets auto theme mode', async () => {
    await themeStore.init();
    await themeStore.setMode('auto');
    const state = get(themeStore);
    expect(state.mode).toBe('auto');
    expect(['light', 'dark']).toContain(state.effectiveTheme);
  });

  it('applies dark class to document when theme is dark', async () => {
    await themeStore.init();
    await themeStore.setMode('dark');
    
    if (typeof document !== 'undefined') {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    }
  });

  it('removes dark class from document when theme is light', async () => {
    await themeStore.init();
    await themeStore.setMode('dark');
    await themeStore.setMode('light');
    
    if (typeof document !== 'undefined') {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    }
  });
});
