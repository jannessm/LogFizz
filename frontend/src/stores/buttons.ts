import { writable, derived } from 'svelte/store';
import type { Button } from '../types';
import { buttonApi, isOnline } from '../services/api';
import { getAllButtons, saveButton as saveButtonDB } from '../lib/db';
import { syncService } from '../services/sync';

interface ButtonsStore {
  buttons: Button[];
  isLoading: boolean;
  error: string | null;
}

function createButtonsStore() {
  const { subscribe, set, update } = writable<ButtonsStore>({
    buttons: [],
    isLoading: false,
    error: null,
  });

  return {
    subscribe,

    async load() {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        // Load from local DB first
        const localButtons = await getAllButtons();
        update(state => ({ ...state, buttons: localButtons, isLoading: false }));

        // Try to sync with server if online
        if (isOnline()) {
          try {
            const serverButtons = await buttonApi.getAll();
            // Save to local DB
            for (const button of serverButtons) {
              await saveButtonDB(button);
            }
            update(state => ({ ...state, buttons: serverButtons }));
          } catch (error) {
            console.error('Failed to sync buttons from server:', error);
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

    async create(buttonData: Partial<Button>) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const button: Button = {
          id: crypto.randomUUID(),
          user_id: '', // Will be set by backend
          name: buttonData.name || '',
          emoji: buttonData.emoji,
          color: buttonData.color,
          position: buttonData.position || 0,
          icon: buttonData.icon,
          goal_time_minutes: buttonData.goal_time_minutes,
          goal_days: buttonData.goal_days,
          auto_subtract_breaks: buttonData.auto_subtract_breaks ?? false,
          created_at: new Date().toISOString(),
        };

        if (isOnline()) {
          try {
            const created = await buttonApi.create(button);
            await saveButtonDB(created);
            update(state => ({ 
              ...state, 
              buttons: [...state.buttons, created].sort((a, b) => a.position - b.position),
              isLoading: false 
            }));
            return created;
          } catch (error) {
            // If API fails, queue for sync
            await syncService.queueButtonCreate(button);
            update(state => ({ 
              ...state, 
              buttons: [...state.buttons, button].sort((a, b) => a.position - b.position),
              isLoading: false 
            }));
            return button;
          }
        } else {
          // Offline: queue for sync
          await syncService.queueButtonCreate(button);
          update(state => ({ 
            ...state, 
            buttons: [...state.buttons, button].sort((a, b) => a.position - b.position),
            isLoading: false 
          }));
          return button;
        }
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },

    async update(id: string, updates: Partial<Button>) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        update(state => {
          const index = state.buttons.findIndex(b => b.id === id);
          if (index === -1) throw new Error('Button not found');
          
          const updatedButton = { ...state.buttons[index], ...updates };
          
          if (isOnline()) {
            buttonApi.update(id, updates)
              .then(async (serverButton) => {
                await saveButtonDB(serverButton);
              })
              .catch(() => {
                // Queue for sync if API fails
                syncService.queueButtonUpdate(updatedButton);
              });
          } else {
            syncService.queueButtonUpdate(updatedButton);
          }

          const newButtons = [...state.buttons];
          newButtons[index] = updatedButton;
          
          return { 
            ...state, 
            buttons: newButtons.sort((a, b) => a.position - b.position),
            isLoading: false 
          };
        });
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },

    async delete(id: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        if (isOnline()) {
          try {
            await buttonApi.delete(id);
          } catch (error) {
            // Queue for sync if API fails
            await syncService.queueButtonDelete(id);
          }
        } else {
          await syncService.queueButtonDelete(id);
        }

        update(state => ({
          ...state,
          buttons: state.buttons.filter(b => b.id !== id),
          isLoading: false
        }));
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },

    clearError() {
      update(state => ({ ...state, error: null }));
    },
  };
}

export const buttonsStore = createButtonsStore();

// Derived store for sorted buttons
export const sortedButtons = derived(
  buttonsStore,
  $buttonsStore => $buttonsStore.buttons.sort((a, b) => a.position - b.position)
);
