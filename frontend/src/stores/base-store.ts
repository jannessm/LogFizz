import { writable, get } from 'svelte/store';
import { isOnline } from '../services/api';
import { syncService } from '../services/sync';
import dayjs from '../../../lib/utils/dayjs.js';

/**
 * Base interface for all store items
 */
export interface BaseItem {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Common store state structure
 */
export interface BaseStoreState<T extends BaseItem> {
  items: T[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Database operations interface
 */
export interface DbOperations<T extends BaseItem> {
  getAll: () => Promise<T[]>;
  save: (item: T) => Promise<void>;
  delete: (item: T) => Promise<void>;
}

/**
 * Sync operations interface
 */
export interface SyncOperations<T extends BaseItem> {
  queueUpsert: (item: T) => Promise<void>;
  queueDelete: (item: T) => Promise<void>;
  syncType: 'timer' | 'timelog' | 'target' | 'balance';
}

/**
 * Optional hooks for custom logic
 */
export interface StoreHooks<T extends BaseItem> {
  afterLoad?: (items: T[]) => Promise<T[]> | T[];
  beforeCreate?: (item: T) => Promise<void> | void;
  afterCreate?: (item: T) => Promise<void> | void;
  beforeUpdate?: (item: T, state: BaseStoreState<T>) => Promise<T> | void;
  afterUpdate?: (item: T) => Promise<void> | void;
  beforeDelete?: (item: T) => Promise<void> | void;
  afterDelete?: (item: T) => Promise<void> | void;
}

/**
 * Configuration for creating a base store
 */
export interface BaseStoreConfig<T extends BaseItem> {
  db: DbOperations<T>;
  sync: SyncOperations<T>;
  hooks?: StoreHooks<T>;
  storeName?: string;
}

/**
 * Helper functions for upsert and delete operations
 */
function createStoreHelpers<T extends BaseItem>(config: BaseStoreConfig<T>) {
  async function upsert(item: T) {
    await config.db.save(item);
    await config.sync.queueUpsert(item);
    if (isOnline()) {
      syncService.sync(config.sync.syncType);
    }
  }

  async function deleteItem(item: T) {
    await config.db.delete(item);
    await config.sync.queueDelete(item);
    if (isOnline()) {
      syncService.sync(config.sync.syncType);
    }
  }

  return { upsert, deleteItem };
}

/**
 * Creates a base store with common CRUD operations
 */
export function createBaseStore<T extends BaseItem>(config: BaseStoreConfig<T>) {
  const { subscribe, set, update } = writable<BaseStoreState<T>>({
    items: [],
    isLoading: false,
    error: null,
  });

  const { upsert, deleteItem } = createStoreHelpers(config);
  const hooks = config.hooks || {};

  return {
    subscribe,
    updateWriteable: update,

    syncCallbackRegistered: false,

    /**
     * Load items from local DB and sync with server if online
     */
    async load(sync: boolean = true) {
      update(state => ({ ...state, isLoading: true, error: null }));

      if (!this.syncCallbackRegistered) {
        syncService.afterSync(config.sync.syncType, async () => {
          await this.load(false);
        });
        this.syncCallbackRegistered = true;
      }

      try {
        // Load from local DB first
        const allItems = await config.db.getAll();
        console.log(`Loaded ${allItems.length} items from local DB for ${config.storeName || 'Store'}`);

        // filter out deleted items and clean up old deleted items
        const items: T[] = [];
        for (const item of allItems) {
          if (!item.deleted_at) {
            items.push(item);
          }

          // delete item locally if older than 3 months
          if (item.deleted_at && dayjs().diff(dayjs(item.deleted_at), 'month') > 3) {
            await deleteItem(item);
          }
        }

        let finalItems = items;
        if (hooks.afterLoad) {
          finalItems = await hooks.afterLoad(items);
        }
        
        update(state => ({ ...state, items: finalItems, isLoading: false }));

        // Try to pull incremental changes from server if online
        if (isOnline() && sync) {
          await syncService.sync(config.sync.syncType);
        }
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
      }
    },

    /**
     * Create a new item
     */
    async create(item: T): Promise<T> {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        // Run before hook
        if (hooks.beforeCreate) {
          await hooks.beforeCreate(item);
        }

        await upsert(item);

        // Run after hook
        if (hooks.afterCreate) {
          await hooks.afterCreate(item);
        }

        update(state => ({ 
          ...state, 
          items: [...state.items, item],
          isLoading: false 
        }));

        return item;
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },

    /**
     * Update an existing item
     */
    async update(id: string, updates: Partial<T>): Promise<T> {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const state = get({ subscribe });
        const existingItem = state.items.find(item => item.id === id);
        if (!existingItem) {
          throw new Error(`${config.storeName || 'Item'} not found`);
        }

        let updatedItem: T = {
          ...existingItem,
          ...updates,
          updated_at: dayjs().toISOString(),
        };

        // Run before hook
        if (hooks.beforeUpdate) {
          await hooks.beforeUpdate(updatedItem, state);
        }

        await upsert(updatedItem);

        // Run after hook
        if (hooks.afterUpdate) {
          await hooks.afterUpdate(updatedItem);
        }

        update(state => ({
          ...state,
          items: state.items.map(item => item.id === id ? updatedItem : item),
          isLoading: false
        }));

        return updatedItem;
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          error: error.message,
          isLoading: false 
        }));
        throw error;
      }
    },

    /**
     * Delete an item
     */
    async delete(item: T): Promise<void> {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        // Run before hook
        if (hooks.beforeDelete) {
          await hooks.beforeDelete(item);
        }

        await deleteItem(item);

        // Run after hook
        if (hooks.afterDelete) {
          await hooks.afterDelete(item);
        }

        update(state => ({
          ...state,
          items: state.items.filter(i => i.id !== item.id),
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

    /**
     * Clear error state
     */
    clearError() {
      update(state => ({ ...state, error: null }));
    },

    /**
     * Get current state (useful for internal operations)
     */
    getState(): BaseStoreState<T> {
      return get({ subscribe });
    },
  };
}
