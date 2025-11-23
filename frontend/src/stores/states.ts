import { writable } from 'svelte/store';
import type { State } from '../types';
import { statesApi } from '../services/api';
import { getAllStates, saveStates } from '../lib/db';

interface StateStore {
  states: State[] | [];
  isLoading: boolean;
  error: string | null;
}

function createStateStore() {
  const { subscribe, set, update } = writable<StateStore>({
    states: [],
    isLoading: true,
    error: null,
  });

  return {
    subscribe,
    
    async load() {
      update(state => ({ ...state, isLoading: true }));
      try {
        // Try to load user from IndexedDB first
        const states = await getAllStates();
        if (states && states.length > 0) {
          update(state => ({ 
            ...state, 
            states: states,
            isLoading: false 
          }));
        }

        // Try to fetch from API if online
        try {
          const states = await statesApi.getAllStates();
          await saveStates(states);
          update(states => ({ 
            ...states,
            isLoading: false,
          }));
        } catch (error) {
          console.error('Error fetching states from API:', error);
          update(state => ({ 
            ...state, 
            error: 'Failed to fetch states from server',
            isLoading: false 
          }));
        }
      } catch (error: any) {
        console.error('Error loading states:', error);
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
      }
    },

    clearError() {
      update(state => ({ ...state, error: null }));
    },
  };
}

export const statesStore = createStateStore();
