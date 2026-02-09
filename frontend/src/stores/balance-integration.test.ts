import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Balance, TimeLog, TargetWithSpecs } from '../types';
import dayjs from '../../../lib/utils/dayjs.js';

// Store mock targets, timers, and timelogs for tests to modify
let mockTargets: TargetWithSpecs[] = [];
let mockTimers: { id: string; target_id: string; name: string }[] = [];
let mockTimelogs: TimeLog[] = [];
let mockBalances: Balance[] = [];

// Mock the db module
vi.mock('../lib/db', () => ({
  getBalancesByDate: vi.fn(),
  getBalancesByTargetId: vi.fn().mockImplementation(() => Promise.resolve(mockBalances)),
  getAllBalances: vi.fn().mockImplementation(() => Promise.resolve(mockBalances)),
  saveBalance: vi.fn().mockImplementation((balance: Balance) => {
    const existing = mockBalances.find(b => b.id === balance.id);
    if (existing) {
      Object.assign(existing, balance);
    } else {
      mockBalances.push(balance);
    }
    return Promise.resolve(balance);
  }),
  deleteBalance: vi.fn(),
  getBalance: vi.fn().mockImplementation((id: string) => {
    return Promise.resolve(mockBalances.find(b => b.id === id));
  }),
  getTimeLogsByYearMonth: vi.fn().mockImplementation(() => Promise.resolve(mockTimelogs)),
  saveTimeLog: vi.fn().mockImplementation((timelog: TimeLog) => {
    const existing = mockTimelogs.find(t => t.id === timelog.id);
    if (existing) {
      Object.assign(existing, timelog);
    } else {
      mockTimelogs.push(timelog);
    }
    return Promise.resolve(timelog);
  }),
  deleteTimeLog: vi.fn(),
  getAllTargets: vi.fn().mockImplementation(() => Promise.resolve(mockTargets)),
  saveTarget: vi.fn(),
  deleteTarget: vi.fn(),
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
    queueUpsertTimeLog: vi.fn().mockResolvedValue(undefined),
    queueDeleteTimeLog: vi.fn().mockResolvedValue(undefined),
    queueUpsertTarget: vi.fn().mockResolvedValue(undefined),
    queueDeleteTarget: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn().mockResolvedValue(undefined),
    afterSync: vi.fn(),
  },
}));

// Mock the timers store to use our mockTimers array
vi.mock('./timers', () => ({
  timers: {
    subscribe: vi.fn((cb) => {
      cb(mockTimers);
      return () => {};
    }),
  },
}));

// Mock the targets store to use our mockTargets array
vi.mock('./targets', () => ({
  targets: {
    subscribe: vi.fn((cb) => {
      cb(mockTargets);
      return () => {};
    }),
  },
  targetsStore: {
    getTargetsByTimerIds: vi.fn().mockImplementation(async (timerIds: string[]) => {
      if (timerIds.length === 0) {
        return [];
      }
      
      const timersForIds = mockTimers.filter(t => timerIds.includes(t.id));
      if (timersForIds.length === 0) {
        return [];
      }
      
      return mockTargets.filter(target => 
        timersForIds.find(t => target.id === t.target_id)
      );
    }),
  },
}));

vi.mock('./holidays', () => ({
  holidaysStore: {
    getHolidaysForMonth: vi.fn().mockReturnValue([]),
    fetchHolidaysForStates: vi.fn(),
  },
}));

// Import after mocks are set up
import { balancesStore } from './balances';
import { timeLogsStore } from './timelogs';

describe('Balance Calculation Integration Tests', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Reset mock data
    mockTargets = [];
    mockTimers = [];
    mockTimelogs = [];
    mockBalances = [];
    
    // Reset the stores
    balancesStore.updateWriteable(() => ({
      items: new Map(),
      isLoading: false,
      error: null,
      syncCallbackRegistered: false,
    }));
    
    timeLogsStore.updateWriteable(() => ({
      items: new Map(),
      isLoading: false,
      error: null,
      syncCallbackRegistered: false,
    }));
  });

  it('should calculate balances when importing old timelogs (issue scenario)', async () => {
    // Setup: Create a user with a timer and a target
    const userId = 'user-1';
    const targetId = 'target-1';
    const timerId = 'timer-1';
    
    mockTargets = [{
      id: targetId,
      user_id: userId,
      name: 'Work Target',
      target_specs: [{
        id: 'spec-1',
        user_id: userId,
        target_id: targetId,
        starting_from: '2025-11-01', // Starting from November 1, 2025
        duration_minutes: [0, 480, 480, 480, 480, 480, 0], // Mon-Fri: 8h per day
        exclude_holidays: false,
      }],
      created_at: '2025-11-01T00:00:00Z',
      updated_at: '2025-11-01T00:00:00Z',
    }];
    
    mockTimers = [{
      id: timerId,
      target_id: targetId,
      name: 'Work Timer',
    }];

    // Import old timelogs starting from November 1, 2025
    const importedTimelogs: TimeLog[] = [
      {
        id: 'timelog-1',
        user_id: userId,
        timer_id: timerId,
        type: 'normal',
        whole_day: false,
        start_timestamp: '2025-11-03T09:00:00Z', // Monday, Nov 3, 2025
        end_timestamp: '2025-11-03T17:00:00Z',   // 8 hours
        duration_minutes: 480,
        timezone: 'UTC',
        apply_break_calculation: false,
        notes: '',
        created_at: '2025-11-03T17:00:00Z',
        updated_at: '2025-11-03T17:00:00Z',
        year: 2025,
        month: 11,
      },
      {
        id: 'timelog-2',
        user_id: userId,
        timer_id: timerId,
        type: 'normal',
        whole_day: false,
        start_timestamp: '2025-11-04T09:00:00Z', // Tuesday, Nov 4, 2025
        end_timestamp: '2025-11-04T17:30:00Z',   // 8.5 hours
        duration_minutes: 510,
        timezone: 'UTC',
        apply_break_calculation: false,
        notes: '',
        created_at: '2025-11-04T17:30:00Z',
        updated_at: '2025-11-04T17:30:00Z',
        year: 2025,
        month: 11,
      },
    ];
    
    mockTimelogs = importedTimelogs;

    // Create a new timelog (simulating the issue where new timelog doesn't change balance)
    const newTimelog: TimeLog = {
      id: 'timelog-3',
      user_id: userId,
      timer_id: timerId,
      type: 'normal',
      whole_day: false,
      start_timestamp: '2025-11-05T09:00:00Z', // Wednesday, Nov 5, 2025
      end_timestamp: '2025-11-05T16:00:00Z',   // 7 hours
      duration_minutes: 420,
      timezone: 'UTC',
      apply_break_calculation: false,
      notes: '',
      created_at: '2025-11-05T16:00:00Z',
      updated_at: '2025-11-05T16:00:00Z',
      year: 2025,
      month: 11,
    };

    // Trigger balance calculation for the new timelog
    // This simulates what happens when a timelog is created
    await timeLogsStore.create(newTimelog);
    mockTimelogs.push(newTimelog);

    // Verify that balances were calculated
    // Check daily balance for Nov 3
    const nov3Balance = mockBalances.find(b => b.id === `${targetId}_2025-11-03`);
    expect(nov3Balance).toBeDefined();
    expect(nov3Balance?.due_minutes).toBe(480);
    expect(nov3Balance?.worked_minutes).toBe(480);

    // Check daily balance for Nov 4
    const nov4Balance = mockBalances.find(b => b.id === `${targetId}_2025-11-04`);
    expect(nov4Balance).toBeDefined();
    expect(nov4Balance?.due_minutes).toBe(480);
    expect(nov4Balance?.worked_minutes).toBe(510);

    // Check daily balance for Nov 5 (the new timelog)
    const nov5Balance = mockBalances.find(b => b.id === `${targetId}_2025-11-05`);
    expect(nov5Balance).toBeDefined();
    expect(nov5Balance?.due_minutes).toBe(480);
    expect(nov5Balance?.worked_minutes).toBe(420);

    // Check monthly balance for November 2025
    const novMonthlyBalance = mockBalances.find(b => b.id === `${targetId}_2025-11`);
    expect(novMonthlyBalance).toBeDefined();
    // This should include all days from Nov 1 to today (or target end date)
    // At minimum, it should include the 3 worked days
    expect(novMonthlyBalance?.worked_minutes).toBeGreaterThanOrEqual(480 + 510 + 420);
  });

  it('should calculate balances when creating a new timelog', async () => {
    // Setup: Create a user with a timer and a target
    const userId = 'user-1';
    const targetId = 'target-1';
    const timerId = 'timer-1';
    
    mockTargets = [{
      id: targetId,
      user_id: userId,
      name: 'Work Target',
      target_specs: [{
        id: 'spec-1',
        user_id: userId,
        target_id: targetId,
        starting_from: '2026-02-01',
        duration_minutes: [0, 480, 480, 480, 480, 480, 0], // Mon-Fri: 8h per day
        exclude_holidays: false,
      }],
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
    }];
    
    mockTimers = [{
      id: timerId,
      target_id: targetId,
      name: 'Work Timer',
    }];

    // Create a new timelog (don't add to mockTimelogs first - let create() do it)
    const newTimelog: TimeLog = {
      id: 'timelog-1',
      user_id: userId,
      timer_id: timerId,
      type: 'normal',
      whole_day: false,
      start_timestamp: '2026-02-03T09:00:00Z', // Monday, Feb 3, 2026
      end_timestamp: '2026-02-03T17:00:00Z',   // 8 hours
      duration_minutes: 480,
      timezone: 'UTC',
      apply_break_calculation: false,
      notes: '',
      created_at: '2026-02-03T17:00:00Z',
      updated_at: '2026-02-03T17:00:00Z',
      year: 2026,
      month: 2,
    };

    // Trigger balance calculation
    await timeLogsStore.create(newTimelog);

    // Verify that a daily balance was created for Feb 3
    const feb3Balance = mockBalances.find(b => b.id === `${targetId}_2026-02-03`);
    expect(feb3Balance).toBeDefined();
    expect(feb3Balance?.due_minutes).toBe(480);
    expect(feb3Balance?.worked_minutes).toBe(480);

    // Verify that balances exist (monthly balance should be created too)
    expect(mockBalances.length).toBeGreaterThan(0);
  });
});
