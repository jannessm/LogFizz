import ky from 'ky';
import type { User, Button, TimeLog, Holiday, DailyTarget, State } from '../types';

// In development, use proxy (relative path). In production, use env variable or default to same origin
const API_BASE_URL = import.meta.env.PROD 
  ? (import.meta.env.VITE_API_URL || window.location.origin)
  : '';

// Create a ky instance with default options
const api = ky.create({
  prefixUrl: API_BASE_URL,
  credentials: 'include', // Important for session cookies
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth API
export const authApi = {
  async register(email: string, password: string, name: string, country?: string, state?: string): Promise<User> {
    return api.post('api/auth/register', { json: { email, password, name, country, state } }).json();
  },

  async login(email: string, password: string): Promise<User> {
    console.log('Attempting login with API_BASE_URL:', API_BASE_URL);
    console.log('Full URL will be:', API_BASE_URL + '/api/auth/login');
    const response = await api.post('api/auth/login', { json: { email, password } });
    console.log('Login response status:', response.status);
    console.log('Login response headers:', Object.fromEntries(response.headers.entries()));
    console.log('Cookies (will be empty - managed by browser):', response.headers.get('set-cookie'));
    
    const userData = await response.json() as User;
    
    // Try to make a test request to /me to check if session works
    console.log('Testing session with /me endpoint...');
    try {
      const meResponse = await api.get('api/auth/me');
      console.log('✓ Test /me request successful - session is working!');
      const meData = await meResponse.json();
      console.log('Me response:', meData);
    } catch (error) {
      console.error('✗ Test /me request failed - session not working:', error);
    }
    
    return userData;
  },

  async logout(): Promise<void> {
    await api.post('api/auth/logout', { 
      headers: { 'Content-Type': undefined } 
    });
  },

  async getCurrentUser(): Promise<User> {
    return api.get('api/auth/me').json();
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.put('api/auth/change-password', { 
      json: { currentPassword, newPassword } 
    });
  },

  async updateProfile(data: { name?: string; email?: string; state_entries?: Array<{ id?: string; state_id: string; registered_at: string }> }): Promise<User> {
    return api.put('api/auth/profile', { json: data }).json();
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return api.post('api/auth/forgot-password', { json: { email } }).json();
  },

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return api.post('api/auth/reset-password', { json: { token, newPassword } }).json();
  },

  async verifyEmail(token: string): Promise<{ message: string }> {
    return api.post('api/auth/verify-email', { json: { token } }).json();
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    return api.post('api/auth/resend-verification', { json: { email } }).json();
  },
};

// Button API
export const buttonApi = {
  async getAll(): Promise<Button[]> {
    return api.get('api/buttons').json();
  },

  async get(id: string): Promise<Button> {
    return api.get(`api/buttons/${id}`).json();
  },

  async create(button: Partial<Button>): Promise<Button> {
    return api.post('api/buttons', { json: button }).json();
  },

  async update(id: string, button: Partial<Button>): Promise<Button> {
    return api.put(`api/buttons/${id}`, { json: button }).json();
  },

  async delete(id: string): Promise<void> {
    await api.delete(`api/buttons/${id}`);
  },

  // Cursor-based sync endpoints
  async getSyncChanges(since: string): Promise<{ buttons: Button[]; cursor: string }> {
    const searchParams = new URLSearchParams({ since });
    return api.get('api/buttons/sync', { searchParams }).json();
  },

  async pushSyncChanges(buttons: Partial<Button>[]): Promise<{
    saved?: Button[];
    conflicts?: Array<{
      id: string;
      field: string;
      clientVersion: Partial<Button>;
      serverVersion: Button;
    }>;
    cursor: string;
  }> {
    return api.post('api/buttons/sync', { json: { buttons } }).json();
  },
};

// TimeLog API
export const timeLogApi = {
  async start(buttonId: string): Promise<TimeLog> {
    return api.post('api/timelogs/start', { json: { button_id: buttonId } }).json();
  },

  async stop(id: string): Promise<TimeLog> {
    return api.post(`api/timelogs/stop/${id}`).json();
  },

  async getAll(params?: {
    start_date?: string;
    end_date?: string;
    button_id?: string;
  }): Promise<TimeLog[]> {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (params?.button_id) searchParams.set('button_id', params.button_id);
    
    return api.get('api/timelogs', { searchParams }).json();
  },

  async getTodayTime(buttonId: string): Promise<{ total_minutes: number }> {
    return api.get(`api/timelogs/today/${buttonId}`).json();
  },

  async getYearlyStats(year?: number): Promise<any[]> {
    const searchParams = year ? new URLSearchParams({ year: year.toString() }) : undefined;
    return api.get('api/timelogs/stats/yearly', { searchParams }).json();
  },

  async getGoalProgress(buttonId: string, date?: string): Promise<any> {
    const searchParams = date ? new URLSearchParams({ date }) : undefined;
    return api.get(`api/timelogs/goal-progress/${buttonId}`, { searchParams }).json();
  },

  async createManual(timeLog: Partial<TimeLog>): Promise<TimeLog> {
    return api.post('api/timelogs/manual', { json: timeLog }).json();
  },

  async update(id: string, timeLog: Partial<TimeLog>): Promise<TimeLog> {
    return api.put(`api/timelogs/${id}`, { json: timeLog }).json();
  },

  async delete(id: string): Promise<void> {
    await api.delete(`api/timelogs/${id}`);
  },

  // Cursor-based sync endpoints
  async getSyncChanges(since: string): Promise<{ timeLogs: TimeLog[]; cursor: string }> {
    const searchParams = new URLSearchParams({ since });
    return api.get('api/timelogs/sync', { searchParams }).json();
  },

  async pushSyncChanges(timeLogs: Partial<TimeLog>[]): Promise<{
    saved?: TimeLog[];
    conflicts?: Array<{
      id: string;
      field: string;
      clientVersion: Partial<TimeLog>;
      serverVersion: TimeLog;
    }>;
    cursor: string;
  }> {
    return api.post('api/timelogs/sync', { json: { timeLogs } }).json();
  },
};

// Daily Target API
export const targetApi = {
  // Cursor-based sync endpoints
  async getSyncChanges(since: string): Promise<{ targets: any[]; cursor: string }> {
    const searchParams = new URLSearchParams({ since });
    return api.get('api/targets/sync', { searchParams }).json();
  },

  async pushSyncChanges(targets: any[]): Promise<{
    saved?: any[];
    conflicts?: Array<{
      clientVersion: any;
      serverVersion: any;
    }>;
    cursor: string;
  }> {
    return api.post('api/targets/sync', { json: { targets } }).json();
  },
};

// Holiday API
export const holidayApi = {
  async getHolidays(country: string, year: number): Promise<Holiday[]> {
    return api.get(`api/holidays/${country}/${year}`).json();
  },

  async getWorkingDays(params: {
    country: string;
    year: number;
    month?: number;
  }): Promise<any> {
    const searchParams = new URLSearchParams({
      country: params.country,
      year: params.year.toString(),
    });
    if (params.month) {
      searchParams.set('month', params.month.toString());
    }
    return api.get('api/holidays/workingdays/summary', { searchParams }).json();
  },

  async getCountries(): Promise<string[]> {
    return api.get('api/holidays/countries').json();
  },
};

export const statesApi = {
  async getAllStates(): Promise<State[]> {
    return api.get(`api/states`).json();
  },

  async getStatesByCountry(country: string): Promise<State[]> {
    return api.get(`api/states/${country}`).json();
  },
};

// Check if online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Retry with exponential backoff
export async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
}
