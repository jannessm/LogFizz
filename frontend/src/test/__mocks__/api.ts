import { vi } from 'vitest';
import type { User, Timer, TimeLog } from '../../types';
import type { TargetWithSpecs } from '../../types';

// Mock user data
export const mockUser: User = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock timer data (formerly button)
export const mockTimer: Timer = {
  id: 'timer-1',
  user_id: '1',
  name: 'Work',
  emoji: '💼',
  color: '#3B82F6',
  auto_subtract_breaks: true,
  archived: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock target data with nested target_specs
export const mockTarget: TargetWithSpecs = {
  id: 'target-1',
  user_id: '1',
  name: 'Daily Work',
  target_specs: [{
    id: 'spec-1',
    user_id: '1',
    target_id: 'target-1',
    starting_from: '2024-01-01',
    duration_minutes: [0, 480, 480, 480, 480, 480, 0], // 8 hours for each weekday // Mon-Fri
    exclude_holidays: false,
  }],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock timelog data - with session structure
export const mockTimeLog: TimeLog = {
  id: 'log-1',
  user_id: '1',
  timer_id: 'timer-1',
  type: 'normal',
  whole_day: false,
  start_timestamp: '2024-01-01T09:00:00Z',
  end_timestamp: '2024-01-01T17:00:00Z',
  duration_minutes: 480,
  timezone: 'UTC',
  apply_break_calculation: false,
  created_at: '2024-01-01T09:00:00Z',
  updated_at: '2024-01-01T17:00:00Z',
};

// Mock timelog data - active timer (no end timestamp)
export const mockActiveTimeLog: TimeLog = {
  id: 'log-2',
  user_id: '1',
  timer_id: 'timer-1',
  type: 'normal',
  whole_day: false,
  start_timestamp: '2024-01-02T09:00:00Z',
  timezone: 'UTC',
  apply_break_calculation: false,
  created_at: '2024-01-02T09:00:00Z',
  updated_at: '2024-01-02T09:00:00Z',
};

// Mock auth API
export const authApi = {
  register: vi.fn().mockResolvedValue(mockUser),
  login: vi.fn().mockResolvedValue(mockUser),
  logout: vi.fn().mockResolvedValue(undefined),
  getCurrentUser: vi.fn().mockResolvedValue(mockUser),
  changePassword: vi.fn().mockResolvedValue(undefined),
  updateProfile: vi.fn().mockResolvedValue(mockUser),
};

// Mock timer API (formerly button)
export const timerApi = {
  getSyncChanges: vi.fn().mockResolvedValue({ timers: [mockTimer], cursor: new Date().toISOString() }),
  pushSyncChanges: vi.fn().mockResolvedValue({ saved: [mockTimer], conflicts: [], cursor: new Date().toISOString() }),
};

// Mock timeLog API
export const timeLogApi = {
  getSyncChanges: vi.fn().mockResolvedValue({ timeLogs: [mockTimeLog], cursor: new Date().toISOString() }),
  pushSyncChanges: vi.fn().mockResolvedValue({ saved: [mockTimeLog], conflicts: [], cursor: new Date().toISOString() }),
};

// Mock target API
export const targetApi = {
  getSyncChanges: vi.fn().mockResolvedValue({ targets: [mockTarget], cursor: new Date().toISOString() }),
  pushSyncChanges: vi.fn().mockResolvedValue({ saved: [mockTarget], conflicts: [], cursor: new Date().toISOString() }),
};

// Mock balance API
export const balanceApi = {
  getSyncChanges: vi.fn().mockResolvedValue({ balances: [], cursor: new Date().toISOString() }),
  pushSyncChanges: vi.fn().mockResolvedValue({ saved: [], conflicts: [], cursor: new Date().toISOString() }),
};

// Mock holiday API
export const holidayApi = {
  getHolidays: vi.fn().mockResolvedValue([]),
  getWorkingDays: vi.fn().mockResolvedValue({ working_days: 20 }),
  getCountries: vi.fn().mockResolvedValue(['US', 'DE']),
};

// Mock isOnline
export const isOnline = vi.fn().mockReturnValue(true);

// Mock retryRequest
export const retryRequest = vi.fn().mockImplementation((fn) => fn());
