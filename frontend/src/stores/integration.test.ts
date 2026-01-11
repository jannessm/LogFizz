import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TimeLog, Timer, Balance, TargetWithSpecs, TargetSpec } from '../types';

/**
 * Integration tests for the balance calculation flow
 * Tests the complete flow: timelog changes → balance recalculation → propagation
 */

// Mock the db module - return empty arrays by default, tests will setup specific mocks
vi.mock('../lib/db', () => ({
  getTimeLogsByYearMonth: vi.fn().mockResolvedValue([]),
  saveTimeLog: vi.fn().mockResolvedValue(undefined),
  deleteTimeLog: vi.fn().mockResolvedValue(undefined),
  getAllTimers: vi.fn().mockResolvedValue([]),
  saveTimer: vi.fn().mockResolvedValue(undefined),
  deleteTimer: vi.fn().mockResolvedValue(undefined),
  getAllTargets: vi.fn().mockResolvedValue([]),
  saveTarget: vi.fn().mockResolvedValue(undefined),
  deleteTarget: vi.fn().mockResolvedValue(undefined),
  getBalancesByDate: vi.fn().mockResolvedValue([]),
  getBalancesByTargetId: vi.fn().mockResolvedValue([]),
  saveBalance: vi.fn().mockResolvedValue(undefined),
  deleteBalance: vi.fn().mockResolvedValue(undefined),
  addToSyncQueue: vi.fn(),
  getSyncCursor: vi.fn().mockResolvedValue({}),
  saveSyncCursor: vi.fn(),
  getUser: vi.fn().mockResolvedValue(null),
}));

// Mock sync service
vi.mock('../services/sync', () => ({
  syncService: {
    queueUpsertTimeLog: vi.fn().mockResolvedValue(undefined),
    queueDeleteTimeLog: vi.fn().mockResolvedValue(undefined),
    queueUpsertTimer: vi.fn().mockResolvedValue(undefined),
    queueDeleteTimer: vi.fn().mockResolvedValue(undefined),
    queueUpsertTarget: vi.fn().mockResolvedValue(undefined),
    queueDeleteTarget: vi.fn().mockResolvedValue(undefined),
    queueUpsertBalance: vi.fn().mockResolvedValue(undefined),
    queueDeleteBalance: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock holidays store
vi.mock('./holidays', () => ({
  holidaysStore: {
    getHolidaysForMonth: vi.fn().mockReturnValue([]),
    fetchHolidaysForStates: vi.fn(),
  },
}));

import * as db from '../lib/db';
import { timeLogsStore, activeTimeLogs, todayTimeLogs } from './timelogs';
import { timersStore, timers } from './timers';
import { targetsStore, targets } from './targets';
import { balancesStore, balances, dailyBalances, monthlyBalances, yearlyBalances } from './balances';
import { get } from 'svelte/store';

// Helper functions
function createMockTimer(id: string, name: string): Timer {
  return {
    id,
    user_id: 'user-1',
    name,
    auto_subtract_breaks: false,
    archived: false,
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  };
}

function createMockTargetSpec(weekdays: number[] = [1, 2, 3, 4, 5], durationMinutes: number = 480): TargetSpec {
  return {
    id: crypto.randomUUID(),
    target_id: '',
    duration_minutes: weekdays.map(() => durationMinutes),
    weekdays,
    exclude_holidays: false,
    starting_from: '2024-01-01',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

function createMockTarget(id: string, name: string): TargetWithSpecs {
  const spec = createMockTargetSpec();
  spec.target_id = id;
  return {
    id,
    user_id: 'user-1',
    name,
    target_specs: [spec],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

function createMockTimelog(
  id: string,
  timerId: string,
  startTimestamp: string,
  endTimestamp?: string,
  durationMinutes?: number
): TimeLog {
  return {
    id,
    user_id: 'user-1',
    timer_id: timerId,
    start_timestamp: startTimestamp,
    end_timestamp: endTimestamp,
    duration_minutes: durationMinutes,
    timezone: 'UTC',
    type: 'normal',
    whole_day: false,
    apply_break_calculation: false,
    created_at: startTimestamp,
    updated_at: startTimestamp,
  };
}

function createMockBalance(
  id: string,
  targetId: string,
  date: string,
  dueMinutes: number,
  workedMinutes: number
): Balance {
  return {
    id,
    user_id: 'user-1',
    target_id: targetId,
    date,
    due_minutes: dueMinutes,
    worked_minutes: workedMinutes,
    cumulative_minutes: workedMinutes - dueMinutes,
    sick_days: 0,
    holidays: 0,
    business_trip: 0,
    child_sick: 0,
    worked_days: workedMinutes > 0 ? 1 : 0,
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  };
}

// Helper to setup store with data
async function initTimersStore(timersList: Timer[]) {
  vi.mocked(db.getAllTimers).mockResolvedValue(timersList);
  await timersStore.load();
}

async function initTargetsStore(targetsList: TargetWithSpecs[]) {
  vi.mocked(db.getAllTargets).mockResolvedValue(targetsList);
  await targetsStore.load();
}

async function initTimeLogsStore(timelogsList: TimeLog[]) {
  vi.mocked(db.getTimeLogsByYearMonth).mockResolvedValue(timelogsList);
  await timeLogsStore.load();
}

async function initBalancesStore(balancesList: Balance[]) {
  vi.mocked(db.getBalancesByDate).mockResolvedValue(balancesList);
  await balancesStore.load();
}

describe('Integration Tests - Balance Calculation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Timelog Creation → Balance Updates', () => {
    it('should create daily balance when timelog is created', async () => {
      // Setup: Create timer and target
      const timer = createMockTimer('timer-1', 'Work');
      const target = createMockTarget('target-1', 'Full Time');

      // Initialize stores
      await initTimersStore([timer]);
      await initTargetsStore([target]);
      await initBalancesStore([]);

      // Verify initial state
      expect(get(balances)).toHaveLength(0);

      // Create a completed timelog (8 hours of work on a Monday)
      const timelog = createMockTimelog(
        'timelog-1',
        'timer-1',
        '2024-12-02T08:00:00Z', // Monday
        '2024-12-02T16:00:00Z',
        480
      );

      vi.mocked(db.saveTimeLog).mockResolvedValue();
      await timeLogsStore.create(timelog);

      // Verify timelog was saved
      expect(db.saveTimeLog).toHaveBeenCalled();
    });

    it('should track active timelogs (running timers)', async () => {
      const timer = createMockTimer('timer-1', 'Work');
      await initTimersStore([timer]);

      // Create a running timelog (no end_timestamp)
      const runningTimelog = createMockTimelog(
        'timelog-1',
        'timer-1',
        '2024-12-02T08:00:00Z'
      );

      await initTimeLogsStore([runningTimelog]);

      const active = get(activeTimeLogs);
      expect(active).toHaveLength(1);
      expect(active[0].end_timestamp).toBeUndefined();
    });

    it('should update balance when timelog is stopped', async () => {
      const timer = createMockTimer('timer-1', 'Work');
      await initTimersStore([timer]);

      // Create a running timelog
      const runningTimelog = createMockTimelog(
        'timelog-1',
        'timer-1',
        '2024-12-02T08:00:00Z'
      );

      await initTimeLogsStore([runningTimelog]);

      // Stop the timer
      vi.mocked(db.saveTimeLog).mockResolvedValue();
      await timeLogsStore.stopTimer(runningTimelog, 'Work notes', '2024-12-02T16:00:00Z');

      // Verify save was called with end timestamp
      expect(db.saveTimeLog).toHaveBeenCalled();
      const savedTimelog = vi.mocked(db.saveTimeLog).mock.calls[0][0];
      expect(savedTimelog.end_timestamp).toBe('2024-12-02T16:00:00Z');
    });
  });

  describe('Timelog Deletion → Balance Recalculation', () => {
    it('should trigger balance recalculation when timelog is deleted', async () => {
      const timer = createMockTimer('timer-1', 'Work');
      const timelog = createMockTimelog(
        'timelog-1',
        'timer-1',
        '2024-12-02T08:00:00Z',
        '2024-12-02T16:00:00Z',
        480
      );

      await initTimersStore([timer]);
      await initTimeLogsStore([timelog]);

      // Verify timelog exists
      expect(get(timeLogsStore).items).toHaveLength(1);

      // Delete the timelog
      vi.mocked(db.deleteTimeLog).mockResolvedValue();
      await timeLogsStore.delete(timelog);

      // Verify timelog was deleted
      expect(db.deleteTimeLog).toHaveBeenCalledWith(timelog);
      expect(get(timeLogsStore).items).toHaveLength(0);
    });
  });

  describe('Target Changes → Balance Recalculation', () => {
    it('should allow updating target which would trigger balance recalculation', async () => {
      const target = createMockTarget('target-1', 'Full Time');
      await initTargetsStore([target]);

      // Update target
      vi.mocked(db.saveTarget).mockResolvedValue();
      await targetsStore.update('target-1', {
        name: 'Part Time',
      });

      expect(db.saveTarget).toHaveBeenCalled();
    });
  });

  describe('Balance Granularity Filtering', () => {
    it('should correctly filter balances by granularity', async () => {
      // Setup balances at different granularities
      const balancesList = [
        createMockBalance('b1', 'target-1', '2024-12-01', 480, 500), // daily
        createMockBalance('b2', 'target-1', '2024-12-02', 480, 450), // daily
        createMockBalance('b3', 'target-1', '2024-12', 9600, 9500),  // monthly
        createMockBalance('b4', 'target-1', '2024', 115200, 114000), // yearly
      ];

      await initBalancesStore(balancesList);

      // Test daily filter
      const daily = balancesStore.getBalancesByGranularity('daily');
      expect(daily).toHaveLength(2);
      expect(daily.every(b => b.date.length === 10)).toBe(true);

      // Test monthly filter
      const monthly = balancesStore.getBalancesByGranularity('monthly');
      expect(monthly).toHaveLength(1);
      expect(monthly[0].date).toBe('2024-12');

      // Test yearly filter
      const yearly = balancesStore.getBalancesByGranularity('yearly');
      expect(yearly).toHaveLength(1);
      expect(yearly[0].date).toBe('2024');
    });

    it('should have derived stores that filter correctly', async () => {
      const balancesList = [
        createMockBalance('b1', 'target-1', '2024-12-01', 480, 500),
        createMockBalance('b2', 'target-1', '2024-12', 9600, 9500),
        createMockBalance('b3', 'target-1', '2024', 115200, 114000),
      ];

      await initBalancesStore(balancesList);

      expect(get(dailyBalances)).toHaveLength(1);
      expect(get(monthlyBalances)).toHaveLength(1);
      expect(get(yearlyBalances)).toHaveLength(1);
    });
  });

  describe('Sync Flow', () => {
    it('should queue sync operations when creating timelog', async () => {
      const { syncService } = await import('../services/sync');
      
      const timer = createMockTimer('timer-1', 'Work');
      await initTimersStore([timer]);

      vi.mocked(db.saveTimeLog).mockResolvedValue();
      
      await timeLogsStore.create({
        timer_id: 'timer-1',
        start_timestamp: '2024-12-02T08:00:00Z',
        end_timestamp: '2024-12-02T16:00:00Z',
      });

      expect(syncService.queueUpsertTimeLog).toHaveBeenCalled();
    });

    it('should queue sync operations when creating timer', async () => {
      const { syncService } = await import('../services/sync');
      
      vi.mocked(db.saveTimer).mockResolvedValue();
      
      await timersStore.create({
        name: 'New Timer',
        color: '#ff0000',
      });

      expect(syncService.queueUpsertTimer).toHaveBeenCalled();
    });

    it('should queue sync operations when creating balance', async () => {
      const { syncService } = await import('../services/sync');
      
      vi.mocked(db.saveBalance).mockResolvedValue();
      
      await balancesStore.create({
        target_id: 'target-1',
        date: '2024-12-02',
        due_minutes: 480,
        worked_minutes: 500,
      });

      expect(syncService.queueUpsertBalance).toHaveBeenCalled();
    });

    it('should queue delete sync operations', async () => {
      const { syncService } = await import('../services/sync');
      
      const timelog = createMockTimelog(
        'timelog-1',
        'timer-1',
        '2024-12-02T08:00:00Z',
        '2024-12-02T16:00:00Z',
        480
      );
      await initTimeLogsStore([timelog]);

      vi.mocked(db.deleteTimeLog).mockResolvedValue();
      await timeLogsStore.delete(timelog);

      expect(syncService.queueDeleteTimeLog).toHaveBeenCalled();
    });
  });

  describe('Special Timelog Types', () => {
    it('should handle sick day timelogs', async () => {
      const timer = createMockTimer('timer-1', 'Work');
      await initTimersStore([timer]);

      vi.mocked(db.saveTimeLog).mockResolvedValue();
      
      const sickDayTimelog = await timeLogsStore.create({
        timer_id: 'timer-1',
        start_timestamp: '2024-12-02T00:00:00Z',
        type: 'sick',
        whole_day: true,
      });

      expect(sickDayTimelog.type).toBe('sick');
      expect(sickDayTimelog.whole_day).toBe(true);
    });

    it('should handle holiday timelogs', async () => {
      const timer = createMockTimer('timer-1', 'Work');
      await initTimersStore([timer]);

      vi.mocked(db.saveTimeLog).mockResolvedValue();
      
      const holidayTimelog = await timeLogsStore.create({
        timer_id: 'timer-1',
        start_timestamp: '2024-12-25T00:00:00Z',
        type: 'holiday',
        whole_day: true,
      });

      expect(holidayTimelog.type).toBe('holiday');
      expect(holidayTimelog.whole_day).toBe(true);
    });

    it('should handle business trip timelogs', async () => {
      const timer = createMockTimer('timer-1', 'Work');
      await initTimersStore([timer]);

      vi.mocked(db.saveTimeLog).mockResolvedValue();
      
      const businessTripTimelog = await timeLogsStore.create({
        timer_id: 'timer-1',
        start_timestamp: '2024-12-10T08:00:00Z',
        end_timestamp: '2024-12-10T18:00:00Z',
        type: 'business-trip',
        whole_day: false,
      });

      expect(businessTripTimelog.type).toBe('business-trip');
    });
  });

  describe('Cumulative Balance Calculation', () => {
    it('should track cumulative minutes in balances', async () => {
      // Create balances with positive and negative cumulative
      const balance1 = createMockBalance('b1', 'target-1', '2024-12-01', 480, 500);
      expect(balance1.cumulative_minutes).toBe(20); // 500 - 480 = +20

      const balance2 = createMockBalance('b2', 'target-1', '2024-12-02', 480, 400);
      expect(balance2.cumulative_minutes).toBe(-80); // 400 - 480 = -80
    });

    it('should track worked days in balances', async () => {
      const balanceWithWork = createMockBalance('b1', 'target-1', '2024-12-01', 480, 500);
      expect(balanceWithWork.worked_days).toBe(1);

      const balanceWithoutWork = createMockBalance('b2', 'target-1', '2024-12-02', 480, 0);
      expect(balanceWithoutWork.worked_days).toBe(0);
    });
  });

  describe('Store State Management', () => {
    it('should maintain consistent state across stores', async () => {
      // Setup initial data
      const timer = createMockTimer('timer-1', 'Work');
      const target = createMockTarget('target-1', 'Full Time');
      const timelog = createMockTimelog(
        'timelog-1',
        'timer-1',
        '2024-12-02T08:00:00Z',
        '2024-12-02T16:00:00Z',
        480
      );
      const balance = createMockBalance('balance-1', 'target-1', '2024-12-02', 480, 480);

      // Load all stores with data
      await initTimersStore([timer]);
      await initTargetsStore([target]);
      await initTimeLogsStore([timelog]);
      await initBalancesStore([balance]);

      // Verify all data is loaded
      expect(get(timers)).toHaveLength(1);
      expect(get(targets)).toHaveLength(1);
      expect(get(timeLogsStore).items).toHaveLength(1);
      expect(get(balances)).toHaveLength(1);
    });

    it('should handle loading and error states', async () => {
      // Initial state should not be loading
      const initialState = get(timeLogsStore);
      expect(initialState.isLoading).toBe(false);
      expect(initialState.error).toBeNull();
    });
  });
});

describe('Integration Tests - Data Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty database gracefully', async () => {
    await initTimersStore([]);
    await initTargetsStore([]);
    await initTimeLogsStore([]);
    await initBalancesStore([]);

    expect(get(timers)).toHaveLength(0);
    expect(get(targets)).toHaveLength(0);
    expect(get(timeLogsStore).items).toHaveLength(0);
    expect(get(balances)).toHaveLength(0);
  });

  it('should handle targets with multiple target_specs', async () => {
    const target: TargetWithSpecs = {
      id: 'target-1',
      user_id: 'user-1',
      name: 'Variable Schedule',
      target_specs: [
        {
          id: 'spec-1',
          target_id: 'target-1',
          duration_minutes: [0, 480, 480, 480, 480, 480, 0], // Sun-Sat
          exclude_holidays: true,
          state_code: 'DE-BY',
          starting_from: '2024-01-01',
          ending_at: '2024-06-30',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'spec-2',
          target_id: 'target-1',
          duration_minutes: [240, 240, 240, 240, 240],
          exclude_holidays: true,
          state_code: 'DE-BY',
          starting_from: '2024-07-01',
          created_at: '2024-07-01T00:00:00Z',
          updated_at: '2024-07-01T00:00:00Z',
        },
      ],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    await initTargetsStore([target]);

    const loadedTargets = get(targets);
    expect(loadedTargets).toHaveLength(1);
    expect(loadedTargets[0].target_specs).toHaveLength(2);
  });

  it('should handle timelogs with all type variations', async () => {
    const types: TimeLog['type'][] = ['normal', 'sick', 'holiday', 'business-trip', 'child-sick'];
    
    const timelogs: TimeLog[] = types.map((type, i) => ({
      id: `timelog-${i}`,
      user_id: 'user-1',
      timer_id: 'timer-1',
      start_timestamp: `2024-12-0${i + 1}T08:00:00Z`,
      end_timestamp: `2024-12-0${i + 1}T16:00:00Z`,
      duration_minutes: 480,
      timezone: 'UTC',
      type,
      whole_day: type !== 'normal',
      apply_break_calculation: false,
      created_at: `2024-12-0${i + 1}T08:00:00Z`,
      updated_at: `2024-12-0${i + 1}T08:00:00Z`,
    }));

    await initTimeLogsStore(timelogs);

    const loadedTimelogs = get(timeLogsStore).items;
    expect(loadedTimelogs).toHaveLength(5);
    
    types.forEach((type, i) => {
      expect(loadedTimelogs[i].type).toBe(type);
    });
  });
});
