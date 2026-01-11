import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Balance, TimeLog, TargetWithSpecs } from '../types';

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

// Store mock targets for tests to modify
let mockTargets: TargetWithSpecs[] = [];
let mockTimers: { id: string; target_id: string }[] = [];

// Mock the timers and targets stores
vi.mock('./timers', () => ({
  timers: {
    subscribe: vi.fn((cb) => {
      cb(mockTimers);
      return () => {};
    }),
  },
}));

vi.mock('./targets', () => ({
  targets: {
    subscribe: vi.fn((cb) => {
      cb(mockTargets);
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

// Helper function to create mock target with specs
function createMockTarget(
  id: string,
  userId: string,
  startingFrom: string,
  endingAt?: string
): TargetWithSpecs {
  return {
    id,
    user_id: userId,
    name: 'Test Target',
    target_specs: [
      {
        id: `${id}-spec-1`,
        user_id: userId,
        target_id: id,
        starting_from: startingFrom,
        ending_at: endingAt,
        duration_minutes: [0, 480, 480, 480, 480, 480, 0], // Mon-Fri 8 hours
        exclude_holidays: false,
        state_code: undefined,
      },
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

// Helper function to create mock timelog
function createMockTimeLog(
  id: string,
  timerId: string,
  startTimestamp: string,
  endTimestamp?: string
): TimeLog {
  return {
    id,
    user_id: 'user-1',
    timer_id: timerId,
    type: 'normal',
    whole_day: false,
    start_timestamp: startTimestamp,
    end_timestamp: endTimestamp,
    duration_minutes: endTimestamp ? 480 : undefined,
    timezone: 'Europe/Berlin',
    apply_break_calculation: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

describe('ensureBalancesUpToDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock data
    mockTargets = [];
    mockTimers = [];
  });

  it('should skip if target has no specs', async () => {
    await initStoreWithBalances([]);
    
    // Target with empty specs
    mockTargets = [{
      id: 'target-1',
      user_id: 'user-1',
      name: 'Test Target',
      target_specs: [],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }];

    await balancesStore.ensureBalancesUpToDate('target-1');

    // Should not have called any balance creation
    expect(db.saveBalance).not.toHaveBeenCalled();
  });

  it('should skip if target is not found', async () => {
    await initStoreWithBalances([]);
    mockTargets = [];

    await balancesStore.ensureBalancesUpToDate('non-existent-target');

    // Should not have called any balance creation
    expect(db.saveBalance).not.toHaveBeenCalled();
  });

  it('should create daily balances from target spec start date to today (first-time init)', async () => {
    await initStoreWithBalances([]);
    vi.mocked(db.saveBalance).mockResolvedValue();
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue(null);
    
    // Target starting from 3 days ago
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const startDate = threeDaysAgo.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7); // YYYY-MM
    const currentYear = today.substring(0, 4); // YYYY
    
    mockTargets = [createMockTarget('target-1', 'user-1', startDate)];
    mockTimers = [{ id: 'timer-1', target_id: 'target-1' }];

    await balancesStore.ensureBalancesUpToDate('target-1');

    // Collect all saveBalance calls
    const saveBalanceCalls = vi.mocked(db.saveBalance).mock.calls;
    
    // Extract dates from the saved balances
    const savedDates = saveBalanceCalls.map(call => (call[0] as Balance).date);
    
    // Should have 4 daily balances (3 days ago, 2 days ago, yesterday, today)
    const dailyDates = savedDates.filter(d => d.length === 10);
    expect(dailyDates).toHaveLength(4);
    
    // Should have 1 monthly balance
    const monthlyDates = savedDates.filter(d => d.length === 7);
    expect(monthlyDates).toHaveLength(1);
    expect(monthlyDates[0]).toBe(currentMonth);
    
    // Should have 1 yearly balance
    const yearlyDates = savedDates.filter(d => d.length === 4);
    expect(yearlyDates).toHaveLength(1);
    expect(yearlyDates[0]).toBe(currentYear);
    
    // Total: 4 daily + 1 monthly + 1 yearly = 6 balances
    expect(db.saveBalance).toHaveBeenCalledTimes(6);
    
    // Metadata should be updated with today's date
    expect(db.setBalanceCalcMetaForTarget).toHaveBeenCalledTimes(1);
    expect(db.setBalanceCalcMetaForTarget).toHaveBeenCalledWith(
      'target-1',
      today,
      'user-1'
    );
  });

  it('should not recreate existing balances when metadata is current', async () => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);
    const currentYear = today.substring(0, 4);
    
    // Pre-populate with existing daily balance for today
    await initStoreWithBalances([
      createMockBalance('target-1_' + today, today),
    ]);
    vi.mocked(db.saveBalance).mockResolvedValue();
    
    // Metadata says we're up to today
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue({
      schema_version: 1,
      user_id: 'user-1',
      targets: {
        'target-1': { last_updated_day: today, updated_at: new Date().toISOString() }
      }
    });
    
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const startDate = twoDaysAgo.toISOString().split('T')[0];
    
    mockTargets = [createMockTarget('target-1', 'user-1', startDate)];
    mockTimers = [{ id: 'timer-1', target_id: 'target-1' }];

    await balancesStore.ensureBalancesUpToDate('target-1');

    // Should only create/update monthly and yearly aggregates (no new daily balances)
    const saveBalanceCalls = vi.mocked(db.saveBalance).mock.calls;
    const savedDates = saveBalanceCalls.map(call => (call[0] as Balance).date);
    
    // No new daily balances should be created (metadata is current)
    const dailyDates = savedDates.filter(d => d.length === 10);
    expect(dailyDates).toHaveLength(0);
    
    // Should still rebuild monthly balance
    const monthlyDates = savedDates.filter(d => d.length === 7);
    expect(monthlyDates).toHaveLength(1);
    expect(monthlyDates[0]).toBe(currentMonth);
    
    // Should still rebuild yearly balance
    const yearlyDates = savedDates.filter(d => d.length === 4);
    expect(yearlyDates).toHaveLength(1);
    expect(yearlyDates[0]).toBe(currentYear);
    
    // Total: 0 daily + 1 monthly + 1 yearly = 2 balances
    expect(db.saveBalance).toHaveBeenCalledTimes(2);
    
    expect(db.setBalanceCalcMetaForTarget).toHaveBeenCalledTimes(1);
  });

  it('should recalculate affected days when timelog is provided', async () => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);
    const currentYear = today.substring(0, 4);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    await initStoreWithBalances([
      createMockBalance('target-1_' + yesterdayStr, yesterdayStr),
      createMockBalance('target-1_' + today, today),
    ]);
    vi.mocked(db.saveBalance).mockResolvedValue();
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue({
      schema_version: 1,
      user_id: 'user-1',
      targets: {
        'target-1': { last_updated_day: today, updated_at: new Date().toISOString() }
      }
    });
    
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const startDate = twoDaysAgo.toISOString().split('T')[0];
    
    mockTargets = [createMockTarget('target-1', 'user-1', startDate)];
    mockTimers = [{ id: 'timer-1', target_id: 'target-1' }];

    // Provide a timelog that spans yesterday
    const affectedTimelog = createMockTimeLog(
      'timelog-1',
      'timer-1',
      `${yesterdayStr}T09:00:00Z`,
      `${yesterdayStr}T17:00:00Z`
    );

    await balancesStore.ensureBalancesUpToDate('target-1', affectedTimelog);

    const saveBalanceCalls = vi.mocked(db.saveBalance).mock.calls;
    const savedDates = saveBalanceCalls.map(call => (call[0] as Balance).date);
    
    // Should recalculate 1 affected daily balance (yesterday)
    const dailyDates = savedDates.filter(d => d.length === 10);
    expect(dailyDates).toHaveLength(1);
    expect(dailyDates).toContain(yesterdayStr);
    
    // Should rebuild monthly balance
    const monthlyDates = savedDates.filter(d => d.length === 7);
    expect(monthlyDates).toHaveLength(1);
    expect(monthlyDates[0]).toBe(currentMonth);
    
    // Should rebuild yearly balance
    const yearlyDates = savedDates.filter(d => d.length === 4);
    expect(yearlyDates).toHaveLength(1);
    expect(yearlyDates[0]).toBe(currentYear);
    
    // Total: 1 daily + 1 monthly + 1 yearly = 3 balances
    expect(db.saveBalance).toHaveBeenCalledTimes(3);
    
    expect(db.setBalanceCalcMetaForTarget).toHaveBeenCalledTimes(1);
  });

  it('should respect target spec ending_at date', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const startDate = twoDaysAgo.toISOString().split('T')[0];
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const endDate = yesterday.toISOString().split('T')[0];
    const endMonth = endDate.substring(0, 7);
    const endYear = endDate.substring(0, 4);
    
    await initStoreWithBalances([]);
    vi.mocked(db.saveBalance).mockResolvedValue();
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue(null);
    
    // Target that ended yesterday
    mockTargets = [createMockTarget('target-1', 'user-1', startDate, endDate)];
    mockTimers = [{ id: 'timer-1', target_id: 'target-1' }];

    await balancesStore.ensureBalancesUpToDate('target-1');

    const saveBalanceCalls = vi.mocked(db.saveBalance).mock.calls;
    const savedDates = saveBalanceCalls.map(call => (call[0] as Balance).date);
    
    // Should have 2 daily balances (2 days ago, yesterday) - NOT today since target ended
    const dailyDates = savedDates.filter(d => d.length === 10);
    expect(dailyDates).toHaveLength(2);
    expect(dailyDates).toContain(startDate);
    expect(dailyDates).toContain(endDate);
    
    // Should have monthly balance
    const monthlyDates = savedDates.filter(d => d.length === 7);
    expect(monthlyDates).toHaveLength(1);
    expect(monthlyDates[0]).toBe(endMonth);
    
    // Should have yearly balance
    const yearlyDates = savedDates.filter(d => d.length === 4);
    expect(yearlyDates).toHaveLength(1);
    expect(yearlyDates[0]).toBe(endYear);
    
    // Total: 2 daily + 1 monthly + 1 yearly = 4 balances
    expect(db.saveBalance).toHaveBeenCalledTimes(4);

    // The setBalanceCalcMetaForTarget should be called with the end date, not today
    expect(db.setBalanceCalcMetaForTarget).toHaveBeenCalledTimes(1);
    expect(db.setBalanceCalcMetaForTarget).toHaveBeenCalledWith(
      'target-1',
      endDate,
      'user-1'
    );
  });

  it('should handle multi-day timelogs correctly', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const startDate = twoDaysAgo.toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);
    const currentYear = today.substring(0, 4);
    
    await initStoreWithBalances([]);
    vi.mocked(db.saveBalance).mockResolvedValue();
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue({
      schema_version: 1,
      user_id: 'user-1',
      targets: {
        'target-1': { last_updated_day: today, updated_at: new Date().toISOString() }
      }
    });
    
    mockTargets = [createMockTarget('target-1', 'user-1', startDate)];
    mockTimers = [{ id: 'timer-1', target_id: 'target-1' }];

    // Multi-day timelog spanning from 2 days ago to yesterday (2 days)
    const multiDayTimelog = createMockTimeLog(
      'timelog-1',
      'timer-1',
      `${startDate}T22:00:00Z`,
      `${yesterdayStr}T02:00:00Z`
    );

    await balancesStore.ensureBalancesUpToDate('target-1', multiDayTimelog);

    const saveBalanceCalls = vi.mocked(db.saveBalance).mock.calls;
    const savedDates = saveBalanceCalls.map(call => (call[0] as Balance).date);
    
    // Should recalculate 2 affected daily balances (startDate and yesterday)
    const dailyDates = savedDates.filter(d => d.length === 10);
    expect(dailyDates).toHaveLength(2);
    expect(dailyDates).toContain(startDate);
    expect(dailyDates).toContain(yesterdayStr);
    
    // Should rebuild monthly balance
    const monthlyDates = savedDates.filter(d => d.length === 7);
    expect(monthlyDates).toHaveLength(1);
    expect(monthlyDates[0]).toBe(currentMonth);
    
    // Should rebuild yearly balance
    const yearlyDates = savedDates.filter(d => d.length === 4);
    expect(yearlyDates).toHaveLength(1);
    expect(yearlyDates[0]).toBe(currentYear);
    
    // Total: 2 daily + 1 monthly + 1 yearly = 4 balances
    expect(db.saveBalance).toHaveBeenCalledTimes(4);
    
    expect(db.setBalanceCalcMetaForTarget).toHaveBeenCalledTimes(1);
  });
});

describe('init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTargets = [];
    mockTimers = [];
  });

  it('should skip initialization when no targets exist', async () => {
    await initStoreWithBalances([]);
    mockTargets = [];

    await balancesStore.init();

    // Should not have called balance operations
    expect(db.saveBalance).not.toHaveBeenCalled();
  });

  it('should call ensureBalancesUpToDate for each target', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const startDate = twoDaysAgo.toISOString().split('T')[0];
    
    await initStoreWithBalances([]);
    vi.mocked(db.saveBalance).mockResolvedValue();
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue(null);
    
    mockTargets = [
      createMockTarget('target-1', 'user-1', startDate),
      createMockTarget('target-2', 'user-1', startDate),
    ];
    mockTimers = [
      { id: 'timer-1', target_id: 'target-1' },
      { id: 'timer-2', target_id: 'target-2' },
    ];

    await balancesStore.init();

    // Should have called setBalanceCalcMetaForTarget for each target
    expect(db.setBalanceCalcMetaForTarget).toHaveBeenCalledTimes(2);
  });

  it('should continue processing other targets if one fails', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const startDate = twoDaysAgo.toISOString().split('T')[0];
    
    await initStoreWithBalances([]);
    
    // First target will fail, second should succeed
    vi.mocked(db.getBalanceCalcMeta)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(db.saveBalance)
      .mockRejectedValueOnce(new Error('DB Error'))
      .mockResolvedValue();
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    
    mockTargets = [
      createMockTarget('target-1', 'user-1', startDate),
      createMockTarget('target-2', 'user-1', startDate),
    ];
    mockTimers = [
      { id: 'timer-1', target_id: 'target-1' },
      { id: 'timer-2', target_id: 'target-2' },
    ];

    // Should not throw even if one target fails
    await expect(balancesStore.init()).resolves.not.toThrow();
  });
});

describe('recalculateBalances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTargets = [];
    mockTimers = [];
  });

  it('should clear metadata and delete existing balances before rebuilding', async () => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);
    const currentYear = today.substring(0, 4);
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const startDate = twoDaysAgo.toISOString().split('T')[0];
    
    await initStoreWithBalances([
      createMockBalance('target-1_' + today, today),
    ]);
    vi.mocked(db.saveBalance).mockResolvedValue();
    vi.mocked(db.deleteBalance).mockResolvedValue();
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    vi.mocked(db.clearBalanceCalcMeta).mockResolvedValue();
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue(null);
    
    mockTargets = [createMockTarget('target-1', 'user-1', startDate)];
    mockTimers = [{ id: 'timer-1', target_id: 'target-1' }];

    await balancesStore.recalculateBalances('target-1');

    // Should have cleared metadata for the target (once)
    expect(db.clearBalanceCalcMeta).toHaveBeenCalledTimes(1);
    expect(db.clearBalanceCalcMeta).toHaveBeenCalledWith('target-1');
    
    // Should have deleted existing balance (1 balance was in store)
    expect(db.deleteBalance).toHaveBeenCalledTimes(1);
    
    // Should have created new balances
    const saveBalanceCalls = vi.mocked(db.saveBalance).mock.calls;
    const savedDates = saveBalanceCalls.map(call => (call[0] as Balance).date);
    
    // Should have 3 daily balances (twoDaysAgo, yesterday, today)
    const dailyDates = savedDates.filter(d => d.length === 10);
    expect(dailyDates).toHaveLength(3);
    
    // Should have monthly balance
    const monthlyDates = savedDates.filter(d => d.length === 7);
    expect(monthlyDates).toHaveLength(1);
    expect(monthlyDates[0]).toBe(currentMonth);
    
    // Should have yearly balance
    const yearlyDates = savedDates.filter(d => d.length === 4);
    expect(yearlyDates).toHaveLength(1);
    expect(yearlyDates[0]).toBe(currentYear);
    
    // Total: 3 daily + 1 monthly + 1 yearly = 5 balances
    expect(db.saveBalance).toHaveBeenCalledTimes(5);
    
    expect(db.setBalanceCalcMetaForTarget).toHaveBeenCalledTimes(1);
  });

  it('should recalculate all targets when no targetId is provided', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const startDate = twoDaysAgo.toISOString().split('T')[0];
    
    await initStoreWithBalances([]);
    vi.mocked(db.saveBalance).mockResolvedValue();
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    vi.mocked(db.clearBalanceCalcMeta).mockResolvedValue();
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue(null);
    
    mockTargets = [
      createMockTarget('target-1', 'user-1', startDate),
      createMockTarget('target-2', 'user-1', startDate),
    ];
    mockTimers = [
      { id: 'timer-1', target_id: 'target-1' },
      { id: 'timer-2', target_id: 'target-2' },
    ];

    await balancesStore.recalculateBalances();

    // Should have cleared metadata for both targets
    expect(db.clearBalanceCalcMeta).toHaveBeenCalledTimes(2);
    expect(db.clearBalanceCalcMeta).toHaveBeenCalledWith('target-1');
    expect(db.clearBalanceCalcMeta).toHaveBeenCalledWith('target-2');
    
    // Should have called setBalanceCalcMetaForTarget for both targets
    expect(db.setBalanceCalcMetaForTarget).toHaveBeenCalledTimes(2);
    
    // Each target should create: 3 daily + 1 monthly + 1 yearly = 5 balances
    // Total for 2 targets = 10 balances
    expect(db.saveBalance).toHaveBeenCalledTimes(10);
  });
});
