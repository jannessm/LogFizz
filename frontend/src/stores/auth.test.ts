import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Mock the dependencies
vi.mock('../services/api', () => ({
  authApi: {
    login: vi.fn().mockResolvedValue({ 
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
    changePassword: vi.fn().mockResolvedValue(undefined),
    updateProfile: vi.fn().mockResolvedValue({ 
      id: '1', 
      email: 'test@example.com', 
      name: 'Updated User',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }),
  },
}));

vi.mock('../lib/db', () => ({
  saveUser: vi.fn().mockResolvedValue(undefined),
  getUser: vi.fn().mockResolvedValue(null),
  clearUser: vi.fn().mockResolvedValue(undefined),
  clearAllData: vi.fn().mockResolvedValue(undefined),
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

  it('handles successful login', async () => {
    const { authStore } = await import('./auth');
    await authStore.login('test@example.com', 'password123');
    const state = get(authStore);
    expect(state.user).toBeTruthy();
    expect(state.isAuthenticated).toBe(true);
  });

  it('handles logout', async () => {
    const { authStore } = await import('./auth');
    await authStore.login('test@example.com', 'password123');
    await authStore.logout();
    const state = get(authStore);
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
