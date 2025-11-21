import { writable } from 'svelte/store';
import type { User } from '../types';
import { authApi } from '../services/api';
import { saveUser, getUser, clearUser, clearAllData } from '../lib/db';
import { wsService } from '../services/websocket';
import type { HTTPError } from 'ky';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthStore>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  return {
    subscribe,
    
    async init() {
      update(state => ({ ...state, isLoading: true }));
      try {
        // Try to load user from IndexedDB first
        const localUser = await getUser();
        if (localUser) {
          update(state => ({ 
            ...state, 
            user: localUser, 
            isAuthenticated: true,
            isLoading: false 
          }));
          wsService.setAuthenticated(true);
        }

        // Try to fetch from API if online
        try {
          const user = await authApi.getCurrentUser();
          await saveUser(user);
          update(state => ({ 
            ...state, 
            user, 
            isAuthenticated: true,
            isLoading: false,
            error: null
          }));
          wsService.setAuthenticated(true);
        } catch (error) {
          let herror = error as HTTPError;
          if (!!herror.response && herror.response.status === 401) {
            // Unauthorized - clear local user
            wsService.setAuthenticated(false);
            await clearAllData();
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            });
          } else {
            console.log((error as HTTPError).response.status);
            // If offline or unauthorized, use local user
            if (!localUser) {
              update(state => ({ 
                ...state, 
                isAuthenticated: false,
                isLoading: false 
              }));
              wsService.setAuthenticated(false);
            } else {
              console.log(error);
              update(state => ({ ...state, isLoading: false }));
              // Keep WebSocket connected if we have a local user
            }
          }
        }
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
      }
    },

    async login(email: string, password: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const user = await authApi.login(email, password);
        await saveUser(user);
        update(state => ({ 
          ...state, 
          user, 
          isAuthenticated: true,
          isLoading: false 
        }));
        wsService.setAuthenticated(true);
        return user;
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Login failed';
        update(state => ({ 
          ...state, 
          error: errorMessage,
          isLoading: false 
        }));
        throw new Error(errorMessage);
      }
    },

    async register(email: string, password: string, name: string, country?: string, state?: string) {
      update(storeState => ({ ...storeState, isLoading: true, error: null }));
      try {
        const user = await authApi.register(email, password, name, country, state);
        await saveUser(user);
        update(storeState => ({ 
          ...storeState, 
          user, 
          isAuthenticated: true,
          isLoading: false 
        }));
        wsService.setAuthenticated(true);
        return user;
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Registration failed';
        update(storeState => ({ 
          ...storeState, 
          error: errorMessage,
          isLoading: false 
        }));
        throw new Error(errorMessage);
      }
    },

    async logout() {
      update(state => ({ ...state, isLoading: true }));
      try {
        await authApi.logout();
      } catch (error) {
        console.error('Logout API call failed:', error);
      } finally {
        wsService.setAuthenticated(false);
        await clearAllData();
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    },

    async updateProfile(name: string, state?: string) {
      update(storeState => ({ ...storeState, isLoading: true, error: null }));
      try {
        const user = await authApi.updateProfile(name, state);
        await saveUser(user);
        update(storeState => ({ 
          ...storeState, 
          user,
          isLoading: false 
        }));
        return user;
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Update failed';
        update(storeState => ({ 
          ...storeState, 
          error: errorMessage,
          isLoading: false 
        }));
        throw new Error(errorMessage);
      }
    },

    async changePassword(currentPassword: string, newPassword: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        await authApi.changePassword(currentPassword, newPassword);
        update(state => ({ ...state, isLoading: false }));
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Password change failed';
        update(state => ({ 
          ...state, 
          error: errorMessage,
          isLoading: false 
        }));
        throw new Error(errorMessage);
      }
    },

    async verifyEmail(token: string): Promise<{ message: string }> {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const response = await authApi.verifyEmail(token);
        // Refresh user data to get updated email_verified_at
        await this.init();
        update(state => ({ ...state, isLoading: false }));
        return response;
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Email verification failed';
        update(state => ({ 
          ...state, 
          error: errorMessage,
          isLoading: false 
        }));
        throw new Error(errorMessage);
      }
    },

    async resendVerification(email: string): Promise<{ message: string }> {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const response = await authApi.resendVerification(email);
        update(state => ({ ...state, isLoading: false }));
        return response;
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Failed to resend verification email';
        update(state => ({ 
          ...state, 
          error: errorMessage,
          isLoading: false 
        }));
        throw new Error(errorMessage);
      }
    },

    clearError() {
      update(state => ({ ...state, error: null }));
    },
  };
}

export const authStore = createAuthStore();
