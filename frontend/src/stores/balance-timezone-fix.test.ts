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
import type { Balance, TargetSpec, Timer, TimeLog } from '../types';
import type { TargetWithSpecs } from '../types';

// Mock modules
vi.mock('../lib/db', () => ({
  getAllBalances: vi.fn().mockResolvedValue([]),
  saveBalance: vi.fn(),
  deleteBalance: vi.fn(),
  getBalancesByDate: vi.fn(),
  getBalancesByTargetId: vi.fn().mockResolvedValue([]),
  getBalance: vi.fn().mockResolvedValue(undefined),
  getTimelogIdsForDate: vi.fn().mockResolvedValue([]),
  getTimeLogsByIds: vi.fn().mockResolvedValue([]),
  ensureTimelogDateIndex: vi.fn().mockResolvedValue(undefined),
  clearTimelogDateIndex: vi.fn().mockResolvedValue(undefined),
  rebuildTimelogDateIndex: vi.fn().mockResolvedValue(undefined),
  getBalanceCalcMeta: vi.fn().mockResolvedValue(null),
  setBalanceCalcMetaForTarget: vi.fn().mockResolvedValue(undefined),
  clearBalanceCalcMeta: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../services/sync', () => ({
  syncService: {
    queueUpsertBalance: vi.fn(),
    queueDeleteBalance: vi.fn(),
    sync: vi.fn(),
  }
}));

// Mock stores
let mockTargets: TargetWithSpecs[] = [];
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
    vi.mocked(db.getTimelogIdsForDate).mockResolvedValue([]);
    vi.mocked(db.getTimeLogsByIds).mockResolvedValue([]);
    vi.mocked(db.ensureTimelogDateIndex).mockResolvedValue(undefined);
  });

  function createTarget(
    targetId: string,
    startDate: string,
    dueMinutesPerDay: number = 480
  ): TargetWithSpecs {
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
      target_specs: [spec],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
  }

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

  function createTimelog(timelogId: string, timerId: string, start: string, end: string): TimeLog {
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

  /** Set up date-index mocks for a list of timelogs. */
  function mockDateIndex(timelogs: TimeLog[]) {
    vi.mocked(db.getTimelogIdsForDate).mockImplementation(async (date: string) => {
      return timelogs
        .filter(tl => {
          const start = dayjs.utc(tl.start_timestamp).startOf('day').format('YYYY-MM-DD');
          const end = (tl.end_timestamp ? dayjs.utc(tl.end_timestamp) : dayjs.utc())
            .startOf('day').format('YYYY-MM-DD');
          return date >= start && date <= end;
        })
        .map(tl => tl.id);
    });
    vi.mocked(db.getTimeLogsByIds).mockImplementation(async (ids: string[]) => {
      return timelogs.filter(tl => ids.includes(tl.id));
    });
  }

  it('should correctly load timelogs when date and timelog are in the same month (UTC)', async () => {
    const testDate = '2024-12-02'; // Monday in December
    const target = createTarget('target-tz-1', testDate, 480);
    const timer = createTimerWithTarget('timer-tz-1', 'target-tz-1');
    const timelog = createTimelog('timelog-tz-1', 'timer-tz-1', `${testDate}T10:00:00Z`, `${testDate}T18:00:00Z`);

    mockTargets = [target];
    mockTimers = [timer];
    mockDateIndex([timelog]);
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue(null);
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    vi.mocked(db.getBalancesByTargetId).mockResolvedValue([]);
    vi.mocked(db.setBalanceCalcMetaForTarget).mockResolvedValue();

    const savedBalances: Balance[] = [];
    vi.mocked(db.saveBalance).mockImplementation(async (balance: Balance) => {
      savedBalances.push(balance);
    });

    await balancesStore.ensureBalancesUpToDate('target-tz-1');

    const dailyBalance = savedBalances.find(b => b.date === testDate);
    expect(dailyBalance).toBeDefined();
    expect(dailyBalance?.worked_minutes).toBe(480); // 8 hours
  });

  it('should correctly load timelogs by date index regardless of year/month indexing', async () => {
    // Verifies that the date-index approach correctly retrieves timelogs
    // regardless of which year/month they are stored under.
    const testDate = '2024-01-31'; // Last day of January
    const target = createTarget('target-tz-2', testDate, 480);
    const timer = createTimerWithTarget('timer-tz-2', 'target-tz-2');
    const timelog = createTimelog('timelog-tz-2', 'timer-tz-2', `${testDate}T22:00:00Z`, `${testDate}T23:59:59Z`);

    mockTargets = [target];
    mockTimers = [timer];
    mockDateIndex([timelog]);
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue(null);
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    vi.mocked(db.getBalancesByTargetId).mockResolvedValue([]);
    vi.mocked(db.setBalanceCalcMetaForTarget).mockResolvedValue();

    const savedBalances: Balance[] = [];
    vi.mocked(db.saveBalance).mockImplementation(async (balance: Balance) => {
      savedBalances.push(balance);
    });

    await balancesStore.ensureBalancesUpToDate('target-tz-2');

    // The timelog is on Jan 31, so the balance for that date should have worked_minutes > 0
    const jan31Balance = savedBalances.find(b => b.date === testDate);
    expect(jan31Balance).toBeDefined();
    expect(jan31Balance?.worked_minutes).toBeGreaterThan(0);
  });

  it('should include spillover timelogs from the previous month that extend into the current month', async () => {
    // Regression test: a whole-day holiday timelog starting 2025-12-30 and ending 2026-01-02
    // must be included when calculating daily balances for 2026-01-01 and 2026-01-02.
    const TARGET_ID = 'target-year-boundary';
    const TIMER_ID = 'timer-year-boundary';
    const target = createTarget(TARGET_ID, '2025-12-30', 480);
    const timer = createTimerWithTarget(TIMER_ID, TARGET_ID);

    // Holiday timelog crossing the year boundary (2025-12-30 → 2026-01-02)
    const holidayTimelog: TimeLog = {
      id: 'holiday-xmas',
      user_id: 'user-1',
      timer_id: TIMER_ID,
      type: 'holiday',
      whole_day: true,
      start_timestamp: '2025-12-30T00:00:00Z',
      end_timestamp: '2026-01-02T23:59:59Z',
      timezone: 'UTC',
      apply_break_calculation: false,
      year: 2025,
      month: 12,
      created_at: '2025-12-30T00:00:00Z',
      updated_at: '2025-12-30T00:00:00Z',
    };

    mockTargets = [target];
    mockTimers = [timer];
    // The date index correctly maps Jan 1 and Jan 2 to this timelog even though
    // its year/month start is December 2025.
    mockDateIndex([holidayTimelog]);
    vi.mocked(db.getBalanceCalcMeta).mockResolvedValue(null);
    vi.mocked(db.getBalance).mockResolvedValue(undefined);
    vi.mocked(db.getBalancesByTargetId).mockResolvedValue([]);
    vi.mocked(db.setBalanceCalcMetaForTarget).mockResolvedValue();

    const savedBalances: Balance[] = [];
    vi.mocked(db.saveBalance).mockImplementation(async (balance: Balance) => {
      savedBalances.push(balance);
    });

    await balancesStore.ensureBalancesUpToDate(TARGET_ID);

    // 2026-01-01 (Thursday) and 2026-01-02 (Friday) should have holidays counted
    const jan1 = savedBalances.find(b => b.date === '2026-01-01');
    const jan2 = savedBalances.find(b => b.date === '2026-01-02');

    expect(jan1).toBeDefined();
    expect(jan2).toBeDefined();

    expect(jan1?.holidays).toBe(1);
    expect(jan1?.worked_minutes).toBe(480);
    expect(jan2?.holidays).toBe(1);
    expect(jan2?.worked_minutes).toBe(480);
  });
});

