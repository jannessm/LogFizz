import { writable } from 'svelte/store';
import type { User } from '../types';
import { authApi } from '../services/api';
import { saveUser, getUser, clearAllData } from '../lib/db';
import type { HTTPError } from 'ky';
import { syncService } from '../services/sync';

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
        } catch (error) {
          let herror = error as HTTPError;
          if (!!herror.response && herror.response.status === 401) {
            // Unauthorized - clear local user
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
            } else {
              console.log(error);
              update(state => ({ ...state, isLoading: false }));
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

    async login(email: string, password: string, hcaptchaToken?: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        // With magic links, login just sends the link
        const response = await authApi.requestMagicLink(email);
        update(state => ({ ...state, isLoading: false }));
        return response;
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

    async requestMagicLink(email: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const response = await authApi.requestMagicLink(email);
        update(state => ({ ...state, isLoading: false }));
        return response;
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Failed to send magic link';
        update(state => ({ 
          ...state, 
          error: errorMessage,
          isLoading: false 
        }));
        throw new Error(errorMessage);
      }
    },

    async verifyMagicLink(token: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const user = await authApi.verifyMagicLink(token);
        await saveUser(user);
        update(state => ({ 
          ...state, 
          user, 
          isAuthenticated: true,
          isLoading: false 
        }));
        return user;
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Magic link verification failed';
        update(state => ({ 
          ...state, 
          error: errorMessage,
          isLoading: false 
        }));
        throw new Error(errorMessage);
      }
    },

    async register(email: string, name: string, hcaptchaToken?: string) {
      update(storeState => ({ ...storeState, isLoading: true, error: null }));
      try {
        await authApi.register(email, name, hcaptchaToken);
        // Do NOT authenticate the user here — they must first verify their
        // email by clicking the magic link sent to their inbox.
        update(storeState => ({ ...storeState, isLoading: false }));
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
        await clearAllData();
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    },

    async updateProfile(data: { name?: string }) {
      update(storeState => ({ ...storeState, isLoading: true, error: null }));
      try {
        const user = await authApi.updateProfile(data);
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

    async requestEmailChange(newEmail: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const response = await authApi.requestEmailChange(newEmail);
        update(state => ({ ...state, isLoading: false }));
        return response;
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Failed to request email change';
        update(state => ({ 
          ...state, 
          error: errorMessage,
          isLoading: false 
        }));
        throw new Error(errorMessage);
      }
    },

    async verifyEmailChange(token: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const response = await authApi.verifyEmailChange(token);
        await saveUser(response);
        // Refresh user data
        await this.init();
        update(state => ({ ...state, isLoading: false }));
        return response;
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Email change verification failed';
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

    async deleteAccount(): Promise<{ message: string }> {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const response = await authApi.deleteAccount();
        // Clear all local data after account deletion
        await clearAllData();
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        return response;
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Failed to delete account';
        update(state => ({ 
          ...state, 
          error: errorMessage,
          isLoading: false 
        }));
        throw new Error(errorMessage);
      }
    },

    async exportUserData(): Promise<any> {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const data = await authApi.exportUserData();
        update(state => ({ ...state, isLoading: false }));
        return data;
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Failed to export user data';
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
