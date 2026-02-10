/**
 * Test to verify timezone handling in balance calculation
 * 
 * This test verifies the fix for the timezone mismatch bug where timelogs
 * were indexed using userTimezone but queried using UTC, causing no timelogs
 * to be found during balance calculation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { balancesStore } from './balances';
import * as db from '../lib/db';
import dayjs from '../../../lib/utils/dayjs.js';
import type { Balance, Target, TargetSpec, Timer, TimeLog } from '../types';

// Mock modules
vi.mock('../lib/db');
vi.mock('../services/sync', () => ({
  syncService: {
    queueUpsertBalance: vi.fn(),
    queueDeleteBalance: vi.fn(),
    sync: vi.fn(),
  }
}));

// Mock stores
let mockTargets: Array<Target & { target_specs: TargetSpec[] }> = [];
let mockTimers: Timer[] = [];

vi.mock('./timers', () => ({
  timers: {
    subscribe: vi.fn((cb) => {
      cb(mockTimers);
      return () => {};
    })
  }
}));

vi.mock('./targets', () => ({
  targets: {
    subscribe: vi.fn((cb) => {
      cb(mockTargets);
      return () => {};
    })
  },
  targetsStore: {
    getTargetsByTimerIds: vi.fn(async () => mockTargets)
  }
}));

vi.mock('./holidays', () => ({
  holidaysStore: {
    getHolidaysForMonth: vi.fn(() => []),
    init: vi.fn()
  }
}));

describe('Balance Calculation - Timezone Bug Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTargets = [];
    mockTimers = [];
    vi.mocked(db.getAllBalances).mockResolvedValue([]);
  });

  /**
   * Helper to create a mock target with specs
   */
  function createTarget(
    targetId: string,
    startDate: string,
    dueMinutesPerDay: number = 480
  ): Target & { target_specs: TargetSpec[] } {
    const spec: TargetSpec = {
      id: 'spec-1',
      user_id: 'user-1',
      target_id: targetId,
      starting_from: startDate,
      ending_at: undefined,
      duration_minutes: [0, dueMinutesPerDay, dueMinutesPerDay, dueMinutesPerDay, dueMinutesPerDay, dueMinutesPerDay, 0],
      exclude_holidays: false,
      state_code: undefined,
    };

    return {
      id: targetId,
      user_id: 'user-1',
      name: 'Test Target',
      target_spec_ids: ['spec-1'],
      target_specs: [spec],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
  }

  /**
   * Helper to create a timer WITH target_id
   */
  function createTimerWithTarget(timerId: string, targetId: string): Timer {
    return {
      id: timerId,
      user_id: 'user-1',
      name: 'Work Timer',
      auto_subtract_breaks: false,
      archived: false,
      target_id: targetId,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
  }

  /**
   * Helper to create a timelog
   * NOTE: The timelog will be saved with year/month in userTimezone
   */
  function createTimelog(
    timelogId: string,
    timerId: string,
    start: string,
    end: string
  ): TimeLog {
    const startDate = dayjs(start);
    return {
      id: timelogId,
      user_id: 'user-1',
      timer_id: timerId,
      type: 'normal',
      whole_day: false,
      start_timestamp: start,
      end_timestamp: end,
      timezone: 'UTC',
      apply_break_calculation: false,
      year: startDate.year(),
      month: startDate.month() + 1,
      created_at: start,
      updated_at: start,
    };
  }

  it('should correctly load timelogs when date and timelog are in the same month (UTC)', async () => {
    // Test case: Simple scenario where timezone doesn't matter
    const testDate = '2024-12-02'; // Monday in December
    const target = createTarget('target-1', testDate, 480);
    const timer = createTimerWithTarget('timer-1', 'target-1');
    
    const timelog = createTimelog(
      'timelog-1',
      'timer-1',
      `${testDate}T10:00:00Z`,
      `${testDate}T18:00:00Z` // 8 hours
    );

    // Set up mocks
    mockTargets = [target];
    mockTimers = [timer];
    vi.mocked(db.getTimeLogsByYearMonth).mockResolvedValue([timelog]);
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue(null);
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    vi.mocked(db.getBalancesByTargetId).mockResolvedValue([]);
    vi.mocked(db.setBalanceCalcMetaForTarget).mockResolvedValue();

    const savedBalances: Balance[] = [];
    vi.mocked(db.saveBalance).mockImplementation(async (balance: Balance) => {
      savedBalances.push(balance);
    });

    await balancesStore.ensureBalancesUpToDate('target-1');

    // Verify getTimeLogsByYearMonth was called with correct year and month
    expect(db.getTimeLogsByYearMonth).toHaveBeenCalledWith(2024, 12);

    const dailyBalance = savedBalances.find(b => b.date === testDate);
    expect(dailyBalance).toBeDefined();
    expect(dailyBalance?.worked_minutes).toBe(480); // 8 hours
  });

  it('should use userTimezone when calculating year/month for timelog query', async () => {
    // This test verifies the fix: dateObj should use .tz(userTimezone)
    const testDate = '2024-01-31'; // Last day of January
    const target = createTarget('target-1', testDate, 480);
    const timer = createTimerWithTarget('timer-1', 'target-1');
    
    // Timelog on Jan 31
    const timelog = createTimelog(
      'timelog-1',
      'timer-1',
      `${testDate}T22:00:00Z`, // 10 PM UTC
      `${testDate}T23:59:59Z`
    );

    mockTargets = [target];
    mockTimers = [timer];
    vi.mocked(db.getTimeLogsByYearMonth).mockResolvedValue([timelog]);
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue(null);
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    vi.mocked(db.getBalancesByTargetId).mockResolvedValue([]);
    vi.mocked(db.setBalanceCalcMetaForTarget).mockResolvedValue();

    const savedBalances: Balance[] = [];
    vi.mocked(db.saveBalance).mockImplementation(async (balance: Balance) => {
      savedBalances.push(balance);
    });

    await balancesStore.ensureBalancesUpToDate('target-1');

    // The key assertion: getTimeLogsByYearMonth should be called with the correct
    // year and month that match how timelogs are indexed (in userTimezone)
    // For date '2024-01-31', it should query month 1 (January)
    const calls = vi.mocked(db.getTimeLogsByYearMonth).mock.calls;
    const janCall = calls.find(call => call[0] === 2024 && call[1] === 1);
    expect(janCall).toBeDefined();
  });
});
