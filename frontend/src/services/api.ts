import ky from 'ky';
import type { User, Timer, TimeLog, Holiday, State, Balance } from '../types';

// In development, use proxy (relative path). In production, use env variable or default to same origin
const API_BASE_URL = import.meta.env.PROD 
  ? (import.meta.env.VITE_API_URL || window.location.origin)
  : 'http://localhost:3000/';
console.log(API_BASE_URL)

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
  async register(email: string, name: string, hcaptchaToken?: string): Promise<User> {
    return api.post('api/auth/register', { 
      json: { 
        email, 
        name,
        ...(hcaptchaToken && { hcaptchaToken })
      } 
    }).json();
  },

  async requestMagicLink(email: string): Promise<{ message: string }> {
    return api.post('api/auth/request-magic-link', { json: { email } }).json();
  },

  async verifyMagicLink(token: string): Promise<User> {
    const response = await api.post('api/auth/verify-magic-link', { json: { token } });
    const userData = await response.json() as User;
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

  async updateProfile(data: { name?: string }): Promise<User> {
    return api.put('api/auth/profile', { json: data }).json();
  },

  async requestEmailChange(newEmail: string): Promise<{ message: string }> {
    return api.post('api/auth/request-email-change', { json: { newEmail } }).json();
  },

  async verifyEmailChange(token: string): Promise<User & { message: string }> {
    return api.post('api/auth/verify-email-change', { json: { token } }).json();
  },

  async verifyEmail(token: string): Promise<{ message: string }> {
    return api.post('api/auth/verify-email', { json: { token } }).json();
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    return api.post('api/auth/resend-verification', { json: { email } }).json();
  },

  async deleteAccount(): Promise<{ message: string }> {
    return api.delete('api/auth/account').json();
  },

  async exportUserData(): Promise<any> {
    return api.get('api/auth/export-data').json();
  },
};

// Timer API (formerly Button)
export const timerApi = {
  // Cursor-based sync endpoints
  async getSyncChanges(since: string): Promise<{ timers: Timer[]; cursor: string }> {
    const searchParams = new URLSearchParams({ since });
    return api.get('api/timers/sync', { searchParams }).json();
  },

  async pushSyncChanges(timers: Partial<Timer>[]): Promise<{
    saved?: Timer[];
    conflicts?: Array<{
      id: string;
      field: string;
      clientVersion: Partial<Timer>;
      serverVersion: Timer;
    }>;
    cursor: string;
  }> {
    return api.post('api/timers/sync', { json: { timers } }).json();
  },
};

// TimeLog API
export const timeLogApi = {
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

// Balance API (replaces Monthly Balance)
export const balanceApi = {
  async getSyncChanges(since: string): Promise<{ balances: Balance[]; cursor: string }> {
    const searchParams = new URLSearchParams({ since });
    return api.get('api/balances/sync', { searchParams }).json();
  },
  async pushSyncChanges(balances: Partial<Balance>[]): Promise<{
    saved?: Balance[];
    conflicts?: Array<{
      id: string;
      field: string;
      clientVersion: Partial<Balance>;
      serverVersion: Balance;
    }>;
    cursor: string;
  }> {
    return api.post('api/balances/sync', { json: { balances } }).json();
  },
};

// User Settings API
export const userSettingsApi = {
  async getSettings(): Promise<import('../types').UserSettings> {
    return api.get('api/user-settings').json();
  },

  async updateSettings(updates: { language?: string; locale?: string; first_day_of_week?: 'sunday' | 'monday'; statistics_email_frequency?: 'none' | 'weekly' | 'monthly'; setup_completed?: boolean }): Promise<import('../types').UserSettings> {
    return api.put('api/user-settings', { json: updates }).json();
  },

  async getSyncChanges(since: string): Promise<{ settings?: import('../types').UserSettings; cursor: string }> {
    const searchParams = new URLSearchParams({ since });
    return api.get('api/user-settings/sync', { searchParams }).json();
  },

  async pushSyncChanges(settings: Partial<import('../types').UserSettings>): Promise<{
    settings: import('../types').UserSettings;
    conflict?: boolean;
    cursor: string;
  }> {
    return api.post('api/user-settings/sync', { json: { settings } }).json();
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
