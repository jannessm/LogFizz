import { vi } from 'vitest';
import type { User, Button, TimeLog } from '../../types';

// Mock user data
export const mockUser: User = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  country: 'US',
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
  goal_days: [1, 2, 3, 4, 5],
  auto_subtract_breaks: true,
  created_at: '2024-01-01T00:00:00Z',
};

// Mock timelog data
export const mockTimeLog: TimeLog = {
  id: 'log-1',
  user_id: '1',
  button_id: 'button-1',
  start_time: '2024-01-01T09:00:00Z',
  end_time: '2024-01-01T17:00:00Z',
  duration: 480,
  is_manual: false,
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
};

// Mock timeLog API
export const timeLogApi = {
  start: vi.fn().mockResolvedValue(mockTimeLog),
  stop: vi.fn().mockResolvedValue({ ...mockTimeLog, end_time: '2024-01-01T17:00:00Z' }),
  getActive: vi.fn().mockResolvedValue(null),
  getAll: vi.fn().mockResolvedValue([mockTimeLog]),
  getTodayTime: vi.fn().mockResolvedValue({ total_minutes: 480 }),
  getYearlyStats: vi.fn().mockResolvedValue([]),
  getGoalProgress: vi.fn().mockResolvedValue({ achieved: true, percentage: 100 }),
  createManual: vi.fn().mockResolvedValue(mockTimeLog),
  update: vi.fn().mockResolvedValue(mockTimeLog),
  delete: vi.fn().mockResolvedValue(undefined),
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
