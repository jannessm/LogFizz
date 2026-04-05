import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Mock the dependencies
vi.mock('../services/api', () => ({
  authApi: {
    requestMagicLink: vi.fn().mockResolvedValue({ message: 'Magic link sent' }),
    verifyMagicLink: vi.fn().mockResolvedValue({ 
      id: '1', 
      email: 'test@example.com', 
      name: 'Test User',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }),
    register: vi.fn().mockResolvedValue({ 
      id: '1', 
      email: 'test@example.com', 
      name: 'Test User',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn().mockResolvedValue({ 
      id: '1', 
      email: 'test@example.com', 
      name: 'Test User',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }),
    updateProfile: vi.fn().mockResolvedValue({ 
      id: '1', 
      email: 'test@example.com', 
      name: 'Updated User',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }),
    requestEmailChange: vi.fn().mockResolvedValue({ message: 'Verification sent' }),
    verifyEmailChange: vi.fn().mockResolvedValue({
      id: '1',
      email: 'new@example.com',
      name: 'Test User',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      message: 'Email changed',
    }),
  },
  timerApi: {
    sync: vi.fn().mockResolvedValue({ timers: [], cursor: '' }),
    push: vi.fn().mockResolvedValue({ saved: [], conflicts: [] }),
  },
  timeLogApi: {
    sync: vi.fn().mockResolvedValue({ timeLogs: [], cursor: '' }),
    push: vi.fn().mockResolvedValue({ saved: [], conflicts: [] }),
  },
  targetApi: {
    sync: vi.fn().mockResolvedValue({ targets: [], cursor: '' }),
    push: vi.fn().mockResolvedValue({ saved: [], conflicts: [] }),
  },
  balanceApi: {
    sync: vi.fn().mockResolvedValue({ balances: [], cursor: '' }),
    push: vi.fn().mockResolvedValue({ saved: [], conflicts: [] }),
  },
}));

vi.mock('../lib/db', () => ({
  saveUser: vi.fn().mockResolvedValue(undefined),
  getUser: vi.fn().mockResolvedValue(null),
  clearUser: vi.fn().mockResolvedValue(undefined),
  clearAllData: vi.fn().mockResolvedValue(undefined),
  saveTimer: vi.fn().mockResolvedValue(undefined),
  deleteTimer: vi.fn().mockResolvedValue(undefined),
  getAllTimers: vi.fn().mockResolvedValue([]),
  saveTimeLog: vi.fn().mockResolvedValue(undefined),
  deleteTimeLog: vi.fn().mockResolvedValue(undefined),
  getAllTimeLogs: vi.fn().mockResolvedValue([]),
  saveTarget: vi.fn().mockResolvedValue(undefined),
  deleteTarget: vi.fn().mockResolvedValue(undefined),
  getAllTargets: vi.fn().mockResolvedValue([]),
  saveBalance: vi.fn().mockResolvedValue(undefined),
  deleteBalance: vi.fn().mockResolvedValue(undefined),
  getAllBalances: vi.fn().mockResolvedValue([]),
  getSyncCursor: vi.fn().mockResolvedValue(null),
  saveSyncCursor: vi.fn().mockResolvedValue(undefined),
}));

describe('Auth Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with loading state', async () => {
    const { authStore } = await import('./auth');
    const state = get(authStore);
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('handles successful magic link verification', async () => {
    const { authStore } = await import('./auth');
    await authStore.verifyMagicLink('test-token');
    const state = get(authStore);
    expect(state.user).toBeTruthy();
    expect(state.isAuthenticated).toBe(true);
  });

  it('handles logout', async () => {
    const { authStore } = await import('./auth');
    await authStore.verifyMagicLink('test-token');
    await authStore.logout();
    const state = get(authStore);
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
