import { writable, derived } from 'svelte/store';
import type { Button } from '../types';
import { buttonApi, isOnline } from '../services/api';
import { getAllButtons, saveButton as saveButtonDB, getSyncCursor, saveSyncCursor, deleteButton as deleteButtonDB } from '../lib/db';
import { syncService } from '../services/sync';

interface ButtonsStore {
  buttons: Button[];
  isLoading: boolean;
  error: string | null;
}


async function upsertButton(button: Button) {
  await saveButtonDB(button);
  await syncService.queueUpsertButton(button);
  if (isOnline()) {
    syncService.sync('button');
  }
}

async function deleteButton(button: Button) {
  await deleteButtonDB(button);
  await syncService.queueDeleteButton(button);
  if (isOnline()) {
    syncService.sync('button');
  }
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

        // Try to pull incremental changes from server if online
        if (isOnline()) {
          await syncService.sync('button');
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
          auto_subtract_breaks: buttonData.auto_subtract_breaks ?? false,
          target_id: buttonData.target_id,
          archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        upsertButton(button);

        update(state => ({ 
          ...state, 
          buttons: [...state.buttons, button].sort((a, b) => a.name.localeCompare(b.name)),
          isLoading: false 
        }));

        return button;
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
          
          const updatedButton = { 
            ...state.buttons[index], 
            ...updates,
            updated_at: new Date().toISOString()
          };
          
          upsertButton(updatedButton);

          const newButtons = [...state.buttons];
          newButtons[index] = updatedButton;
          
          return { 
            ...state, 
            buttons: newButtons.sort((a, b) => a.name.localeCompare(b.name)),
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

    async delete(button: Button) {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        deleteButton(button);
        update(state => ({
          ...state,
          buttons: state.buttons.filter(b => b.id !== button.id),
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
