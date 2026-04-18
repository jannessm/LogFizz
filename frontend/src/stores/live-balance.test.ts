import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { liveBalanceTick, startBalanceUpdates, stopBalanceUpdates, activeTimelogDurations, getBreakDeduction, computeLiveExtraMinutes } from './live-balance';
import type { Timer, TimeLog } from '../types';

// Mock the timelogs store
vi.mock('./timelogs', () => ({
  activeTimeLogs: {
    subscribe: vi.fn((callback) => {
      callback([]);
      return () => {};
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTimer(id: string, targetId: string): Timer {
  return {
    id,
    target_id: targetId,
    user_id: 'u1',
    name: 'Test Timer',
    auto_subtract_breaks: false,
    archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Timer;
}

function makeActiveLog(
  id: string,
  timerId: string,
  startMinutesAgo: number,
  applyBreak = false
): TimeLog {
  const start = new Date(Date.now() - startMinutesAgo * 60 * 1000).toISOString();
  return {
    id,
    timer_id: timerId,
    start_timestamp: start,
    end_timestamp: undefined,
    apply_break_calculation: applyBreak,
    created_at: start,
    updated_at: start,
  } as unknown as TimeLog;
}

describe('live-balance store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with tick count of 0', () => {
    const tick = get(liveBalanceTick);
    expect(tick).toBe(0);
  });

  it('should allow components to start balance updates', () => {
    const componentId = 'test-component-1';
    
    // Should not throw
    expect(() => startBalanceUpdates(componentId)).not.toThrow();
  });

  it('should allow components to stop balance updates', () => {
    const componentId = 'test-component-1';
    
    startBalanceUpdates(componentId);
    
    // Should not throw
    expect(() => stopBalanceUpdates(componentId)).not.toThrow();
  });

  it('should handle multiple components registering for updates', () => {
    const component1 = 'component-1';
    const component2 = 'component-2';
    
    startBalanceUpdates(component1);
    startBalanceUpdates(component2);
    
    // Both should be registered
    stopBalanceUpdates(component1);
    stopBalanceUpdates(component2);
    
    expect(true).toBe(true); // No errors means success
  });

  it('should export activeTimelogDurations derived store', () => {
    expect(activeTimelogDurations).toBeDefined();
    expect(typeof activeTimelogDurations.subscribe).toBe('function');
  });

  it('should provide elapsed minutes for active timelogs', () => {
    const durations = get(activeTimelogDurations);
    expect(Array.isArray(durations)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getBreakDeduction
// ---------------------------------------------------------------------------

describe('getBreakDeduction', () => {
  it('returns 0 for < 6 h', () => {
    expect(getBreakDeduction(0)).toBe(0);
    expect(getBreakDeduction(359)).toBe(0);
  });

  it('returns 30 for 6–9 h', () => {
    expect(getBreakDeduction(360)).toBe(30);
    expect(getBreakDeduction(539)).toBe(30);
  });

  it('returns 45 for ≥ 9 h', () => {
    expect(getBreakDeduction(540)).toBe(45);
    expect(getBreakDeduction(600)).toBe(45);
  });
});

// ---------------------------------------------------------------------------
// computeLiveExtraMinutes — single active timelog
// ---------------------------------------------------------------------------

describe('computeLiveExtraMinutes — single active timelog', () => {
  const targetId = 'target-1';
  const timerId = 'timer-1';
  const timers: Timer[] = [makeTimer(timerId, targetId)];

  it('returns elapsed minutes from active log', () => {
    const activeLogs = [makeActiveLog('tl-1', timerId, 30)];
    const extra = computeLiveExtraMinutes(targetId, timers, activeLogs);
    expect(extra).toBeGreaterThanOrEqual(29);
    expect(extra).toBeLessThanOrEqual(31);
  });

  it('returns 0 when there are no active logs', () => {
    const extra = computeLiveExtraMinutes(targetId, timers, []);
    expect(extra).toBe(0);
  });

  it('returns 0 for an unrelated target', () => {
    const activeLogs = [makeActiveLog('tl-1', timerId, 60)];
    const extra = computeLiveExtraMinutes('other-target', timers, activeLogs);
    expect(extra).toBe(0);
  });

  it('applies break deduction when apply_break_calculation is true (7 h active → 30 min break)', () => {
    // Active for 7 h (420 min) → 30 min break deducted → 390 active min
    const activeLogs = [makeActiveLog('tl-1', timerId, 420, true)];
    const extra = computeLiveExtraMinutes(targetId, timers, activeLogs);
    expect(extra).toBeGreaterThanOrEqual(389);
    expect(extra).toBeLessThanOrEqual(391);
  });
});

// ---------------------------------------------------------------------------
// computeLiveExtraMinutes — multiple completed + 1 active timelog per day
// ---------------------------------------------------------------------------

describe('computeLiveExtraMinutes — multiple timelogs on same day, 1 active', () => {
  const targetId = 'target-1';
  const timerId = 'timer-1';
  const timers: Timer[] = [makeTimer(timerId, targetId)];

  it('ignores completed logs; only active log contributes', () => {
    // Completed timelogs are already in worked_minutes (stored balance) and
    // are NOT included in activeLogs. The active log (40 min) should be returned fully.
    const activeLogs = [makeActiveLog('tl-active', timerId, 40)];
    const extra = computeLiveExtraMinutes(targetId, timers, activeLogs);
    expect(extra).toBeGreaterThanOrEqual(39);
    expect(extra).toBeLessThanOrEqual(41);
  });

  it('sums two active timers for the same target', () => {
    const timerId2 = 'timer-2';
    const timersMulti: Timer[] = [
      makeTimer(timerId, targetId),
      makeTimer(timerId2, targetId),
    ];
    // timer-1 active for 30 min, timer-2 active for 20 min → combined 50 active min
    const activeLogs = [
      makeActiveLog('tl-1', timerId, 30),
      makeActiveLog('tl-2', timerId2, 20),
    ];
    const extra = computeLiveExtraMinutes(targetId, timersMulti, activeLogs);
    expect(extra).toBeGreaterThanOrEqual(49);
    expect(extra).toBeLessThanOrEqual(51);
  });

  it('does not count active logs for a different target', () => {
    const otherTimerId = 'timer-other';
    const timersWithOther: Timer[] = [
      makeTimer(timerId, targetId),
      makeTimer(otherTimerId, 'other-target'),
    ];
    const activeLogs = [
      makeActiveLog('tl-active', timerId, 30),
      makeActiveLog('tl-other', otherTimerId, 60),
    ];
    const extra = computeLiveExtraMinutes(targetId, timersWithOther, activeLogs);
    expect(extra).toBeGreaterThanOrEqual(29);
    expect(extra).toBeLessThanOrEqual(31);
  });
});
