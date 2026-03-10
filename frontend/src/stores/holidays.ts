import { writable } from 'svelte/store';
import type { Holiday } from '../../../lib/types';
import { holidayApi } from '../services/api';
import { onlyUnique } from '../../../lib/utils/helper.js';
import { getDB } from '../lib/db';

interface HolidaysState {
  holidays: Holiday[];
  loading: boolean;
  error: string | null;
  loadedYears: Set<string>; // Track loaded country-year combinations
  initialized: boolean; // Track if we've loaded from IndexedDB
}


function filterHolidaysByCounties(holidays: Holiday[], stateCodes: string[]): Holiday[] {
  return holidays.filter(h => {
    if (h.counties.length === 0) {
      return true; // Include if no counties specified
    }
    return h.counties.some(county => stateCodes.includes(county));
  });
}


function createHolidaysStore() {
  const { subscribe, update, set } = writable<HolidaysState>({
    holidays: [],
    loading: false,
    error: null,
    loadedYears: new Set(),
    initialized: false,
  });

  // Load holidays from IndexedDB on initialization
  async function loadFromCache(): Promise<void> {
    try {
      const db = await getDB();
      const cachedHolidays = await db.getAll('holidays');
      
      if (cachedHolidays.length > 0) {
        const loadedKeys = new Set<string>();
        const holidays: Holiday[] = cachedHolidays.map(h => {
          loadedKeys.add(h.cacheKey);
          // Remove cacheKey before returning
          const { cacheKey, ...holiday } = h;
          return holiday as Holiday;
        });
        
        update(state => ({
          ...state,
          holidays,
          loadedYears: loadedKeys,
          initialized: true,
        }));
      } else {
        update(state => ({ ...state, initialized: true }));
      }
    } catch (error) {
      console.error('Failed to load holidays from cache:', error);
      update(state => ({ ...state, initialized: true }));
    }
  }

  // Save holidays to IndexedDB
  async function saveToCache(country: string, year: number, holidays: Holiday[]): Promise<void> {
    try {
      const db = await getDB();
      const cacheKey = `${country}-${year}`;
      
      // Delete old holidays for this country-year
      const tx = db.transaction('holidays', 'readwrite');
      const index = tx.store.index('by-country-year');
      const oldHolidays = await index.getAll(cacheKey);
      
      for (const old of oldHolidays) {
        await tx.store.delete(old.id);
      }
      
      await tx.done;
      
      // Add new holidays with cacheKey in a new transaction
      const addTx = db.transaction('holidays', 'readwrite');
      for (const holiday of holidays) {
        await addTx.store.put({ ...holiday, cacheKey });
      }
      
      await addTx.done;
    } catch (error) {
      console.error('Failed to save holidays to cache:', error);
    }
  }

  // Initialize on creation
  loadFromCache();

  return {
    subscribe,

    /**
     * Fetch holidays for a specific country and year
     * Caches results to avoid redundant API calls and stores in IndexedDB
     */
    async fetchHolidays(country: string, year: number): Promise<void> {
      const key = `${country}-${year}`;
      
      // Check if already loaded in memory
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
        
        // Save to IndexedDB cache
        await saveToCache(country, year, newHolidays);
        
        update(state => {
          // Add new holidays to the store (keep existing ones for other countries/years)
          const existingHolidays = state.holidays.filter(
            h => !(h.country === country && h.year === year)
          );
          
          return {
            ...state,
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
    getHolidaysForDate(dateString: string, stateCodes?: string[]): Holiday[] {
      let result: Holiday[] = [];
      
      update(state => {
        if (stateCodes && stateCodes.length > 0) {
          result = filterHolidaysByCounties(state.holidays, stateCodes).filter(
            h => h.date === dateString
          );
          console.log(`Found ${result.length} holidays for date ${dateString} in states ${stateCodes.join(', ')}`);
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
    getHolidaysForMonth(county: string, year: number, month: number): Holiday[] {
      let result: Holiday[] = [];
      
      update(state => {
        const monthStr = month.toString().padStart(2, '0');
        const prefix = `${year}-${monthStr}`;
        
        result = filterHolidaysByCounties(state.holidays, [county]).filter(
          h => h.date.startsWith(prefix)
        );
        return state;
      });
      
      return result;
    },

    /**
     * Clear all cached holidays from memory and IndexedDB
     */
    async clear(): Promise<void> {
      try {
        const db = await getDB();
        await db.clear('holidays');
      } catch (error) {
        console.error('Failed to clear holidays cache:', error);
      }
      
      set({
        holidays: [],
        loading: false,
        error: null,
        loadedYears: new Set(),
        initialized: true,
      });
    },
  };
}

export const holidaysStore = createHolidaysStore();
