import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Balance } from '../types';

// Mock the db module
vi.mock('../lib/db', () => ({
  getBalancesByDate: vi.fn(),
  getBalancesByTargetId: vi.fn(),
  saveBalance: vi.fn(),
  deleteBalance: vi.fn(),
  getBalance: vi.fn(),
  getTimeLogsByYearMonth: vi.fn().mockResolvedValue([]),
  addToSyncQueue: vi.fn(),
  getSyncCursor: vi.fn().mockResolvedValue({}),
  saveSyncCursor: vi.fn(),
  getUser: vi.fn().mockResolvedValue(null),
  getBalanceCalcMeta: vi.fn().mockResolvedValue(null),
  setBalanceCalcMetaForTarget: vi.fn().mockResolvedValue(undefined),
  clearBalanceCalcMeta: vi.fn().mockResolvedValue(undefined),
}));

// Mock the sync service
vi.mock('../services/sync', () => ({
  syncService: {
    queueUpsertBalance: vi.fn().mockResolvedValue(undefined),
    queueDeleteBalance: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn().mockResolvedValue(undefined),
    afterSync: vi.fn(), // Register callback but don't invoke it
  },
}));

// Mock the timers and targets stores
vi.mock('./timers', () => ({
  timers: {
    subscribe: vi.fn((cb) => {
      cb([]);
      return () => {};
    }),
  },
}));

vi.mock('./targets', () => ({
  targets: {
    subscribe: vi.fn((cb) => {
      cb([]);
      return () => {};
    }),
  },
}));

vi.mock('./holidays', () => ({
  holidaysStore: {
    getHolidaysForMonth: vi.fn().mockReturnValue([]),
    fetchHolidaysForStates: vi.fn(),
  },
}));

import * as db from '../lib/db';
import { balancesStore, balances, dailyBalances, monthlyBalances, yearlyBalances } from './balances';
import { get } from 'svelte/store';

// Helper to initialize store with balances
async function initStoreWithBalances(balancesList: Balance[]) {
  vi.mocked(db.getBalancesByDate).mockResolvedValue(balancesList);
  await balancesStore.load();
}

describe('balancesStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('load', () => {
    it('should load balances from database', async () => {
      const mockBalances: Balance[] = [
        {
          id: 'target-1_2024-12-01',
          user_id: 'user-1',
          target_id: 'target-1',
          date: '2024-12-01',
          due_minutes: 480,
          worked_minutes: 500,
          cumulative_minutes: 20,
          sick_days: 0,
          holidays: 0,
          business_trip: 0,
          child_sick: 0,
          worked_days: 1,
          created_at: '2024-12-01T00:00:00Z',
          updated_at: '2024-12-01T00:00:00Z',
        },
      ];

      await initStoreWithBalances(mockBalances);

      const state = get(balancesStore);
      expect(state.items).toHaveLength(1);
      expect(state.items[0].due_minutes).toBe(480);
    });
  });

  describe('create', () => {
    it('should create a new balance with default values', async () => {
      await initStoreWithBalances([]);
      vi.mocked(db.saveBalance).mockResolvedValue();

      const newBalance = await balancesStore.create({
        target_id: 'target-1',
        date: '2024-12-15',
        due_minutes: 480,
        worked_minutes: 520,
      });

      expect(newBalance.target_id).toBe('target-1');
      expect(newBalance.date).toBe('2024-12-15');
      expect(newBalance.due_minutes).toBe(480);
      expect(newBalance.worked_minutes).toBe(520);
      expect(newBalance.cumulative_minutes).toBe(0); // default
      expect(newBalance.id).toBe('target-1_2024-12-15'); // composite ID
      expect(db.saveBalance).toHaveBeenCalled();
    });

    it('should create balance with all counter fields', async () => {
      await initStoreWithBalances([]);
      vi.mocked(db.saveBalance).mockResolvedValue();

      const newBalance = await balancesStore.create({
        target_id: 'target-1',
        date: '2024-12-15',
        due_minutes: 480,
        worked_minutes: 0,
        sick_days: 1,
        holidays: 0,
        business_trip: 0,
        child_sick: 0,
      });

      expect(newBalance.sick_days).toBe(1);
      expect(newBalance.holidays).toBe(0);
    });
  });

  describe('update', () => {
    it('should update an existing balance', async () => {
      const existingBalance: Balance = {
        id: 'target-1_2024-12-01',
        user_id: 'user-1',
        target_id: 'target-1',
        date: '2024-12-01',
        due_minutes: 480,
        worked_minutes: 400,
        cumulative_minutes: -80,
        sick_days: 0,
        holidays: 0,
        business_trip: 0,
        child_sick: 0,
        worked_days: 1,
        created_at: '2024-12-01T00:00:00Z',
        updated_at: '2024-12-01T00:00:00Z',
      };

      await initStoreWithBalances([existingBalance]);
      vi.mocked(db.saveBalance).mockResolvedValue();

      const updatedBalance = await balancesStore.update('target-1_2024-12-01', {
        worked_minutes: 500,
        cumulative_minutes: 20,
      });

      expect(updatedBalance.worked_minutes).toBe(500);
      expect(updatedBalance.cumulative_minutes).toBe(20);
      expect(db.saveBalance).toHaveBeenCalled();
    });

    it('should throw error when updating non-existent balance', async () => {
      await initStoreWithBalances([]);

      await expect(
        balancesStore.update('non-existent', { worked_minutes: 100 })
      ).rejects.toThrow('balances not found');
    });
  });

  describe('delete', () => {
    it('should delete an existing balance', async () => {
      const existingBalance: Balance = {
        id: 'target-1_2024-12-01',
        user_id: 'user-1',
        target_id: 'target-1',
        date: '2024-12-01',
        due_minutes: 480,
        worked_minutes: 500,
        cumulative_minutes: 20,
        sick_days: 0,
        holidays: 0,
        business_trip: 0,
        child_sick: 0,
        worked_days: 1,
        created_at: '2024-12-01T00:00:00Z',
        updated_at: '2024-12-01T00:00:00Z',
      };

      await initStoreWithBalances([existingBalance]);
      vi.mocked(db.deleteBalance).mockResolvedValue();

      await balancesStore.delete(existingBalance);

      const state = get(balancesStore);
      expect(state.items).toHaveLength(0);
      expect(db.deleteBalance).toHaveBeenCalledWith(existingBalance);
    });
  });

  describe('getBalancesByGranularity', () => {
    it('should filter daily balances (YYYY-MM-DD)', async () => {
      const mockBalances: Balance[] = [
        createMockBalance('balance-1', '2024-12-01'),
        createMockBalance('balance-2', '2024-12'),
        createMockBalance('balance-3', '2024'),
      ];

      await initStoreWithBalances(mockBalances);

      const daily = balancesStore.getBalancesByGranularity('daily');
      expect(daily).toHaveLength(1);
      expect(daily[0].date).toBe('2024-12-01');
    });

    it('should filter monthly balances (YYYY-MM)', async () => {
      const mockBalances: Balance[] = [
        createMockBalance('balance-1', '2024-12-01'),
        createMockBalance('balance-2', '2024-12'),
        createMockBalance('balance-3', '2024'),
      ];

      await initStoreWithBalances(mockBalances);

      const monthly = balancesStore.getBalancesByGranularity('monthly');
      expect(monthly).toHaveLength(1);
      expect(monthly[0].date).toBe('2024-12');
    });

    it('should filter yearly balances (YYYY)', async () => {
      const mockBalances: Balance[] = [
        createMockBalance('balance-1', '2024-12-01'),
        createMockBalance('balance-2', '2024-12'),
        createMockBalance('balance-3', '2024'),
      ];

      await initStoreWithBalances(mockBalances);

      const yearly = balancesStore.getBalancesByGranularity('yearly');
      expect(yearly).toHaveLength(1);
      expect(yearly[0].date).toBe('2024');
    });
  });

  describe('derived stores', () => {
    it('balances derived store should return all items', async () => {
      const mockBalances: Balance[] = [
        createMockBalance('balance-1', '2024-12-01'),
        createMockBalance('balance-2', '2024-12-02'),
      ];

      await initStoreWithBalances(mockBalances);

      const balancesList = get(balances);
      expect(balancesList).toHaveLength(2);
    });

    it('dailyBalances derived store should filter by date length', async () => {
      const mockBalances: Balance[] = [
        createMockBalance('balance-1', '2024-12-01'),
        createMockBalance('balance-2', '2024-12'),
        createMockBalance('balance-3', '2024'),
      ];

      await initStoreWithBalances(mockBalances);

      const daily = get(dailyBalances);
      expect(daily).toHaveLength(1);
      expect(daily[0].date.length).toBe(10);
    });

    it('monthlyBalances derived store should filter by date length', async () => {
      const mockBalances: Balance[] = [
        createMockBalance('balance-1', '2024-12-01'),
        createMockBalance('balance-2', '2024-12'),
        createMockBalance('balance-3', '2024'),
      ];

      await initStoreWithBalances(mockBalances);

      const monthly = get(monthlyBalances);
      expect(monthly).toHaveLength(1);
      expect(monthly[0].date.length).toBe(7);
    });

    it('yearlyBalances derived store should filter by date length', async () => {
      const mockBalances: Balance[] = [
        createMockBalance('balance-1', '2024-12-01'),
        createMockBalance('balance-2', '2024-12'),
        createMockBalance('balance-3', '2024'),
      ];

      await initStoreWithBalances(mockBalances);

      const yearly = get(yearlyBalances);
      expect(yearly).toHaveLength(1);
      expect(yearly[0].date.length).toBe(4);
    });
  });
});

// Helper function to create mock balance
function createMockBalance(id: string, date: string): Balance {
  return {
    id,
    user_id: 'user-1',
    target_id: 'target-1',
    date,
    due_minutes: 480,
    worked_minutes: 500,
    cumulative_minutes: 20,
    sick_days: 0,
    holidays: 0,
    business_trip: 0,
    child_sick: 0,
    worked_days: 1,
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  };
}
