import { writable } from 'svelte/store';
import type { Holiday } from '../../../lib/types';
import { holidayApi } from '../services/api';
import { onlyUnique } from '../../../lib/utils/helper.js';

interface HolidaysState {
  holidays: Holiday[];
  loading: boolean;
  error: string | null;
  loadedYears: Set<string>; // Track loaded country-year combinations
}


function createHolidaysStore() {
  const { subscribe, update, set } = writable<HolidaysState>({
    holidays: [],
    loading: false,
    error: null,
    loadedYears: new Set(),
  });

  return {
    subscribe,

    /**
     * Fetch holidays for a specific country and year
     * Caches results to avoid redundant API calls
     */
    async fetchHolidays(country: string, year: number): Promise<void> {
      const key = `${country}-${year}`;
      
      // Check if already loaded
      let shouldFetch = false;
      update(state => {
        if (!state.loadedYears.has(key)) {
          shouldFetch = true;
          return { ...state, loading: true, error: null };
        }
        return state;
      });

      if (!shouldFetch) {
        return;
      }

      try {
        const newHolidays = await holidayApi.getHolidays(country, year);
        
        update(state => {
          // Add new holidays to the store (keep existing ones for other countries/years)
          const existingHolidays = state.holidays.filter(
            h => !(h.country === country && h.year === year)
          );
          
          return {
            holidays: [...existingHolidays, ...newHolidays],
            loading: false,
            error: null,
            loadedYears: new Set([...state.loadedYears, key]),
          };
        });
      } catch (error) {
        update(state => ({
          ...state,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch holidays',
        }));
      }
    },

    /**
     * Fetch holidays for multiple countries and a year range
     * Caches results to avoid redundant API calls
     */
    async fetchHolidaysForStates(states: string[], year: number): Promise<void> {
      const countries = states.map(state => state.split('-')[0]).filter(onlyUnique);

      const promises = [];

      // fetch all holidays for the year +/- 3 years
      for (let i = -3; i <= 3; i++) {
        const targetYear = year + i;
        for (const country of countries) {
          promises.push(this.fetchHolidays(country, targetYear));
        }
      }

      await Promise.all(promises);
    },

    /**
     * Check if a specific date is a holiday
     * If states array is provided, checks if it's a holiday in ANY of those states
     */
    isHoliday(dateString: string, states?: string[]): Holiday | null {
      let result: Holiday | null = null;
      
      update(state => {
        if (states && states.length > 0) {
          // Check if holiday exists in any of the specified states
          const holiday = state.holidays.find(
            h => states.includes(h.country) && h.date === dateString
          );
          result = holiday || null;
        } else {
          // Check in any state if none specified
          const holiday = state.holidays.find(h => h.date === dateString);
          result = holiday || null;
        }
        return state;
      });
      
      return result;
    },

    /**
     * Get all holidays for a specific date across all or specified countries
     */
    getHolidaysForDate(dateString: string, countries?: string[]): Holiday[] {
      let result: Holiday[] = [];
      
      update(state => {
        if (countries && countries.length > 0) {
          result = state.holidays.filter(
            h => countries.includes(h.country) && h.date === dateString
          );
        } else {
          result = state.holidays.filter(h => h.date === dateString);
        }
        return state;
      });
      
      return result;
    },

    /**
     * Get all holidays for a specific month
     */
    getHolidaysForMonth(country: string, year: number, month: number): Holiday[] {
      let result: Holiday[] = [];
      
      update(state => {
        const monthStr = month.toString().padStart(2, '0');
        const prefix = `${year}-${monthStr}`;
        
        result = state.holidays.filter(
          h => h.country === country && h.date.startsWith(prefix)
        );
        return state;
      });
      
      return result;
    },

    /**
     * Clear all cached holidays
     */
    clear(): void {
      set({
        holidays: [],
        loading: false,
        error: null,
        loadedYears: new Set(),
      });
    },
  };
}

export const holidaysStore = createHolidaysStore();
