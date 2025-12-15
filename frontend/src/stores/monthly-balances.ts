import { derived } from 'svelte/store';
import type { MonthlyBalance } from '../types';
import { getAllMonthlyBalances, saveMonthlyBalance, deleteMonthlyBalance } from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig } from './base-store';
import dayjs from '../../../lib/utils/dayjs.js';

// Configure the base store for monthly balances
const monthlyBalances: BaseStoreConfig<MonthlyBalance> = {
  db: {
    getAll: getAllMonthlyBalances,
    save: saveMonthlyBalance,
    delete: deleteMonthlyBalance,
  },
  sync: {
    queueUpsert: syncService.queueUpsertMonthlyBalance,
    queueDelete: syncService.queueDeleteMonthlyBalance,
    syncType: 'monthlyBalance',
  },
  storeName: 'monthlyBalances',
};

// Create the base store
const baseStore = createBaseStore<MonthlyBalance>(monthlyBalances);

// Create the buttons store with custom create method
function createBalancesStore() {
  return {
    ...baseStore,

    async create(balanceData: Partial<MonthlyBalance>) {
      return baseStore.create({
        id: crypto.randomUUID(),
        user_id: '',
        target_id: balanceData.target_id || '',
        year: balanceData.year || dayjs().year(),
        month: balanceData.month || dayjs().month() + 1,
        worked_minutes: balanceData.worked_minutes || 0,
        due_minutes: balanceData.due_minutes || 0,
        balance_minutes: balanceData.balance_minutes || 0,
        exclude_holidays: balanceData.exclude_holidays || false,
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString(),
      });
    },
  };
}

export const balancesStore = createBalancesStore();

// Derived store for balances (maps 'items' to 'balances' for backward compatibility)
export const balances = derived(
  balancesStore,
  ($store) => $store.items
);

