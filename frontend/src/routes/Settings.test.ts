import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Settings from './Settings.svelte';

// Mock the stores and services
vi.mock('../stores/auth', () => ({
  authStore: {
    subscribe: vi.fn((callback) => {
      callback({ 
        user: { id: '1', name: 'Test User', email: 'test@example.com' }, 
        isAuthenticated: true 
      });
      return () => {};
    }),
    updateProfile: vi.fn().mockResolvedValue({ id: '1', name: 'Updated User', email: 'test@example.com' }),
    changePassword: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../stores/theme', () => ({
  themeStore: {
    subscribe: vi.fn((callback) => {
      callback({ mode: 'auto', effectiveTheme: 'light' });
      return () => {};
    }),
    init: vi.fn().mockResolvedValue(undefined),
    setMode: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../services/sync', () => ({
  syncService: {
    hasPendingSync: vi.fn().mockResolvedValue(false),
    syncAll: vi.fn().mockResolvedValue(undefined),
    queueUpsertTimer: vi.fn(),
    queueDeleteTimer: vi.fn(),
    queueUpsertTimeLog: vi.fn(),
    queueDeleteTimeLog: vi.fn(),
    queueUpsertTarget: vi.fn(),
    queueDeleteTarget: vi.fn(),
    queueUpsertBalance: vi.fn(),
    queueDeleteBalance: vi.fn(),
  },
}));

vi.mock('../lib/db', () => ({
  getSetting: vi.fn().mockImplementation((key) => {
    if (key === 'editOnStop') return Promise.resolve(true);
    if (key === 'themeMode') return Promise.resolve('auto');
    if (key === 'firstDayOfWeek') return Promise.resolve('sunday');
    return Promise.resolve(null);
  }),
  saveSetting: vi.fn().mockResolvedValue(undefined),
  getDB: vi.fn().mockResolvedValue({}),
  getAllTimers: vi.fn().mockResolvedValue([]),
  saveTimer: vi.fn().mockResolvedValue(undefined),
  deleteTimer: vi.fn().mockResolvedValue(undefined),
  getAllTimeLogs: vi.fn().mockResolvedValue([]),
  saveTimeLog: vi.fn().mockResolvedValue(undefined),
  deleteTimeLog: vi.fn().mockResolvedValue(undefined),
  getAllTargets: vi.fn().mockResolvedValue([]),
  saveTarget: vi.fn().mockResolvedValue(undefined),
  deleteTarget: vi.fn().mockResolvedValue(undefined),
  getAllBalances: vi.fn().mockResolvedValue([]),
  saveBalance: vi.fn().mockResolvedValue(undefined),
  deleteBalance: vi.fn().mockResolvedValue(undefined),
  getBalanceCalcMeta: vi.fn().mockResolvedValue(null),
  saveBalanceCalcMeta: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/navigation', () => ({
  navigate: vi.fn(),
}));

vi.mock('../components/BottomNav.svelte', () => {
  return {
    default: Object,
  };
});

vi.mock('../components/settings/AlertMessage.svelte', () => {
  return {
    default: Object,
  };
});

vi.mock('../components/settings/ProfileSection.svelte', () => {
  return {
    default: Object,
  };
});

vi.mock('../components/settings/PasswordSection.svelte', () => {
  return {
    default: Object,
  };
});

vi.mock('../components/settings/SyncStatusSection.svelte', () => {
  return {
    default: Object,
  };
});

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings page with header', async () => {
    render(Settings);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders appearance section with theme setting', async () => {
    render(Settings);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
  });

  it('renders first day of week setting', async () => {
    render(Settings);
    expect(screen.getByText('First Day of Week')).toBeInTheDocument();
  });

  it('has correct theme options', async () => {
    const { container } = render(Settings);
    
    // Find the theme select - it's the first select element after "Appearance"
    const selects = container.querySelectorAll('select');
    const themeSelect = selects[0] as HTMLSelectElement;
    const options = Array.from(themeSelect.options).map(opt => opt.value);
    
    expect(options).toEqual(['light', 'dark', 'auto']);
  });

  it('has correct first day of week options', async () => {
    const { container } = render(Settings);
    
    // Find the first day of week select - it's the second select element
    const selects = container.querySelectorAll('select');
    const firstDaySelect = selects[1] as HTMLSelectElement;
    const options = Array.from(firstDaySelect.options).map(opt => opt.value);
    
    expect(options).toEqual(['sunday', 'monday']);
  });

  it('calls themeStore.setMode when theme is changed', async () => {
    const { themeStore } = await import('../stores/theme');
    const { container } = render(Settings);
    
    const selects = container.querySelectorAll('select');
    const themeSelect = selects[0] as HTMLSelectElement;
    await fireEvent.change(themeSelect, { target: { value: 'dark' } });
    
    // Wait for the change handler
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(themeStore.setMode).toHaveBeenCalled();
  });

  it('calls saveSetting when first day of week is changed', async () => {
    const { saveSetting } = await import('../lib/db');
    const { container } = render(Settings);
    
    const selects = container.querySelectorAll('select');
    const firstDaySelect = selects[1] as HTMLSelectElement;
    await fireEvent.change(firstDaySelect, { target: { value: 'monday' } });
    
    // Wait for the change handler
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(saveSetting).toHaveBeenCalledWith('firstDayOfWeek', 'monday');
  });

  it('renders timer behavior section', async () => {
    render(Settings);
    expect(screen.getByText('Timer Behavior')).toBeInTheDocument();
  });

  it('renders sign out button', async () => {
    render(Settings);
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });
});
