import { vi } from 'vitest';
import type { User, Button, TimeLog, DailyTarget } from '../../types';

// Mock user data
export const mockUser: User = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock button data
export const mockButton: Button = {
  id: 'button-1',
  user_id: '1',
  name: 'Work',
  emoji: '💼',
  color: '#3B82F6',
  position: 0,
  goal_time_minutes: 480,
  auto_subtract_breaks: true,
  target_id: undefined,
  created_at: '2024-01-01T00:00:00Z',
};

// Mock target data
export const mockTarget: DailyTarget = {
  id: 'target-1',
  user_id: '1',
  name: 'Daily Work',
  duration_minutes: [480, 480, 480, 480, 480], // 8 hours for each weekday
  weekdays: [1, 2, 3, 4, 5], // Mon-Fri
  exclude_holidays: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock timelog data - Start event
export const mockTimeLog: TimeLog = {
  id: 'log-1',
  user_id: '1',
  button_id: 'button-1',
  type: 'start',
  timestamp: '2024-01-01T09:00:00Z',
  apply_break_calculation: false,
  is_manual: false,
  created_at: '2024-01-01T09:00:00Z',
  updated_at: '2024-01-01T09:00:00Z',
};

// Mock timelog data - Stop event
export const mockTimeLogStop: TimeLog = {
  id: 'log-2',
  user_id: '1',
  button_id: 'button-1',
  type: 'stop',
  timestamp: '2024-01-01T17:00:00Z',
  apply_break_calculation: false,
  is_manual: false,
  created_at: '2024-01-01T17:00:00Z',
  updated_at: '2024-01-01T17:00:00Z',
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

// Mock button API
export const buttonApi = {
  getAll: vi.fn().mockResolvedValue([mockButton]),
  get: vi.fn().mockResolvedValue(mockButton),
  create: vi.fn().mockResolvedValue(mockButton),
  update: vi.fn().mockResolvedValue(mockButton),
  delete: vi.fn().mockResolvedValue(undefined),
  getSyncChanges: vi.fn().mockResolvedValue({ buttons: [mockButton], cursor: new Date().toISOString() }),
  pushSyncChanges: vi.fn().mockResolvedValue({ saved: [mockButton], conflicts: [], cursor: new Date().toISOString() }),
};

// Mock timeLog API
export const timeLogApi = {
  start: vi.fn().mockResolvedValue(mockTimeLog),
  stop: vi.fn().mockResolvedValue(mockTimeLogStop),
  getActive: vi.fn().mockResolvedValue(null),
  getAll: vi.fn().mockResolvedValue([mockTimeLog, mockTimeLogStop]),
  getTodayTime: vi.fn().mockResolvedValue({ total_minutes: 480 }),
  getYearlyStats: vi.fn().mockResolvedValue([]),
  getGoalProgress: vi.fn().mockResolvedValue({ achieved: true, percentage: 100 }),
  createManual: vi.fn().mockResolvedValue(mockTimeLog),
  update: vi.fn().mockResolvedValue(mockTimeLog),
  delete: vi.fn().mockResolvedValue(undefined),
  getSyncChanges: vi.fn().mockResolvedValue({ timeLogs: [mockTimeLog, mockTimeLogStop], cursor: new Date().toISOString() }),
  pushSyncChanges: vi.fn().mockResolvedValue({ saved: [mockTimeLog], conflicts: [], cursor: new Date().toISOString() }),
};

// Mock target API
export const targetApi = {
  getSyncChanges: vi.fn().mockResolvedValue({ targets: [mockTarget], cursor: new Date().toISOString() }),
  pushSyncChanges: vi.fn().mockResolvedValue({ saved: [mockTarget], conflicts: [], cursor: new Date().toISOString() }),
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
