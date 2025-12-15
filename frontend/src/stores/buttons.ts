import { derived } from 'svelte/store';
import type { Button } from '../types';
import { getAllButtons, saveButton as saveButtonDB, deleteButton as deleteButtonDB } from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig } from './base-store';
import dayjs from '../../../lib/utils/dayjs.js';

// Configure the base store for buttons
const buttonStoreConfig: BaseStoreConfig<Button> = {
  db: {
    getAll: getAllButtons,
    save: saveButtonDB,
    delete: deleteButtonDB,
  },
  sync: {
    queueUpsert: syncService.queueUpsertButton,
    queueDelete: syncService.queueDeleteButton,
    syncType: 'button',
  },
  storeName: 'Button',
};

// Create the base store
const baseStore = createBaseStore<Button>(buttonStoreConfig);

// Create the buttons store with custom create method
function createButtonsStore() {
  return {
    ...baseStore,

    async create(buttonData: Partial<Button>) {
      return baseStore.create({
        id: crypto.randomUUID(),
        user_id: '', // Will be set by backend
        name: buttonData.name || '',
        emoji: buttonData.emoji,
        color: buttonData.color,
        auto_subtract_breaks: buttonData.auto_subtract_breaks ?? false,
        target_id: buttonData.target_id,
        archived: false,
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString(),
      });
    },
  };
}

export const buttonsStore = createButtonsStore();

// Derived store for buttons (maps 'items' to 'buttons' for backward compatibility)
export const buttons = derived(
  buttonsStore,
  ($store) => $store.items
);
