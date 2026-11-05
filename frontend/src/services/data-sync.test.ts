import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Balance, TargetWithSpecs, TimeLog, Timer } from '../types';

vi.mock('./api', () => ({
  isOnline: vi.fn(() => true),
  timerApi: { getSyncChanges: vi.fn(), pushSyncChanges: vi.fn(async () => ({ cursor: '2025-01-20T00:00:00Z' })) },
  timeLogApi: { getSyncChanges: vi.fn(), pushSyncChanges: vi.fn(async () => ({ cursor: '2025-01-20T00:00:00Z' })) },
  targetApi: { getSyncChanges: vi.fn(), pushSyncChanges: vi.fn(async () => ({ cursor: '2025-01-20T00:00:00Z' })) },
  balanceApi: { getSyncChanges: vi.fn(), pushSyncChanges: vi.fn(async (balances: Balance[]) => ({ saved: balances, cursor: '2025-01-20T00:00:00Z' })) },
}));
vi.mock('../stores/userSettings', () => ({ userSettingsStore: { init: vi.fn() } }));
vi.mock('../lib/dateFormatting', () => ({ initLocaleFromSettings: vi.fn() }));
vi.mock('../stores/holidays', () => ({ holidaysStore: { getHolidaysForMonth: () => [], fetchHolidaysForStates: vi.fn() } }));

import { loadData } from './data';
import { syncService } from './sync';
import { balanceApi, targetApi, timeLogApi, timerApi, isOnline } from './api';
import { getBalance, getDB, saveUser, getTimeLog, getTimelogIdsForDate, saveTimeLog } from '../lib/db';
import { timersStore } from '../stores/timers';
import { timeLogsStore } from '../stores/timelogs';
import { startBalanceUpdates, stopBalanceUpdates } from '../stores/live-balance';
import { balancesStore } from '../stores/balances';

const cursor = '2025-01-20T00:00:00Z';
const timer: Timer = { id: 'timer', user_id: 'user', name: 'Work', target_id: 'target', auto_subtract_breaks: false, archived: false, created_at: cursor, updated_at: cursor };
const target: TargetWithSpecs = {
  id: 'target', user_id: 'user', name: 'Work', created_at: cursor, updated_at: cursor,
  target_specs: [{ id: 'spec', user_id: 'user', target_id: 'target', starting_from: '2025-01-15', ending_at: '2025-01-16', duration_minutes: Array(7).fill(480), exclude_holidays: false }],
};
const log: TimeLog = { id: 'log', user_id: 'user', timer_id: 'timer', type: 'normal', whole_day: false, timezone: 'America/New_York', apply_break_calculation: false, start_timestamp: '2025-01-15T08:00:00Z', end_timestamp: '2025-01-15T16:00:00Z', created_at: cursor, updated_at: cursor };

describe('source sync to derived balances', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(isOnline).mockReturnValue(true);
    const database = await getDB();
    for (const store of ['timers', 'targets', 'timelogs', 'timelogDateIndex', 'balances', 'settings', 'syncQueue', 'user'] as const) await database.clear(store);
    await saveUser({ id: 'user', email: 'test@example.com' } as Parameters<typeof saveUser>[0]);
    vi.mocked(timerApi.getSyncChanges).mockResolvedValue({ timers: [timer], cursor });
    vi.mocked(targetApi.getSyncChanges).mockResolvedValue({ targets: [target], cursor });
    vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({ timeLogs: [log], cursor });
    vi.mocked(balanceApi.getSyncChanges).mockResolvedValue({ balances: [], cursor });
  });

  it('awaits initial source downloads and calculates historical daily, monthly and yearly balances', async () => {
    await loadData(true);
    expect(await getBalance('target_2025-01-15')).toMatchObject({ worked_minutes: 480, due_minutes: 480 });
    expect(await getBalance('target_2025-01')).toMatchObject({ worked_minutes: 480, due_minutes: 960 });
    expect(await getBalance('target_2025')).toMatchObject({ worked_minutes: 480, due_minutes: 960 });
    expect(balanceApi.pushSyncChanges).toHaveBeenCalled();
  });

  it('recomputes history after remote corrections and timer-only reassignment', async () => {
    await loadData(true);
    vi.mocked(timerApi.getSyncChanges).mockResolvedValue({ timers: [], cursor });
    vi.mocked(targetApi.getSyncChanges).mockResolvedValue({ targets: [], cursor });
    vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({ timeLogs: [{ ...log, end_timestamp: '2025-01-15T18:00:00Z' }], cursor });
    await syncService.sync('timelog');
    expect(await getBalance('target_2025-01-15')).toMatchObject({ worked_minutes: 600 });
    vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({ timeLogs: [], cursor });
    vi.mocked(timerApi.getSyncChanges).mockResolvedValue({ timers: [{ ...timer, target_id: null }], cursor });
    await syncService.sync('timer');
    expect(await getBalance('target_2025-01-15')).toMatchObject({ worked_minutes: 0 });
  });

  it('does not count whole-day absences as worked days', async () => {
    vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({ timeLogs: [{ ...log, type: 'sick', whole_day: true }], cursor });
    await loadData(true);
    expect(await getBalance('target_2025-01-15')).toMatchObject({ worked_minutes: 480, worked_days: 0, sick_days: 1 });
    expect(await getBalance('target_2025-01')).toMatchObject({ worked_days: 0, sick_days: 1 });
  });

  it('preserves parent-leave credit and counters without counting a worked day', async () => {
    vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({ timeLogs: [{ ...log, type: 'parent-leave', whole_day: true }], cursor });
    await loadData(true);
    expect(await getBalance('target_2025-01-15')).toMatchObject({ worked_minutes: 480, worked_days: 0, parent_leave: 1 });
    expect(await getBalance('target_2025-01')).toMatchObject({ worked_minutes: 480, worked_days: 0, parent_leave: 1 });
    expect(await getBalance('target_2025')).toMatchObject({ worked_minutes: 480, worked_days: 0, parent_leave: 1 });
  });

  it('removes days outside a shortened target range before aggregation', async () => {
    await loadData(true);
    vi.mocked(timerApi.getSyncChanges).mockResolvedValue({ timers: [], cursor });
    vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({ timeLogs: [], cursor });
    vi.mocked(targetApi.getSyncChanges).mockResolvedValue({
      targets: [{ ...target, target_specs: [{ ...target.target_specs[0], ending_at: '2025-01-15' }] }], cursor,
    });
    await syncService.sync('target');
    expect(await getBalance('target_2025-01-16')).toBeUndefined();
    expect(await getBalance('target_2025-01')).toMatchObject({ due_minutes: 480 });
  });

  it('recalculates a local timer reassignment while offline', async () => {
    await loadData(true);
    vi.mocked(isOnline).mockReturnValue(false);
    await timersStore.update('timer', { target_id: null });
    expect(await getBalance('target_2025-01-15')).toMatchObject({ worked_minutes: 0 });
  });

  it('credits work just after Berlin midnight to January 15', async () => {
    vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({ timeLogs: [{ ...log, timezone: 'Europe/Berlin', start_timestamp: '2025-01-14T23:30:00Z', end_timestamp: '2025-01-15T00:30:00Z' }], cursor });
    await loadData(true);
    expect(await getBalance('target_2025-01-15')).toMatchObject({ worked_minutes: 60 });
  });

  it('recalculates both local dates after a timezone-only edit', async () => {
    vi.mocked(targetApi.getSyncChanges).mockResolvedValue({ targets: [{ ...target, target_specs: [{ ...target.target_specs[0], starting_from: '2025-01-14' }] }], cursor });
    vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({ timeLogs: [{ ...log, start_timestamp: '2025-01-15T00:30:00Z', end_timestamp: '2025-01-15T01:30:00Z' }], cursor });
    await loadData(true);
    expect(await getBalance('target_2025-01-14')).toMatchObject({ worked_minutes: 60 });
    vi.mocked(isOnline).mockReturnValue(false);
    await timeLogsStore.loadLogsByYearMonth(2025, 1);
    await timeLogsStore.update('log', { timezone: 'Europe/Berlin' });
    expect(await getBalance('target_2025-01-14')).toMatchObject({ worked_minutes: 0 });
    expect(await getBalance('target_2025-01-15')).toMatchObject({ worked_minutes: 60 });
  });

  it('includes the current local day when the log timezone is ahead of UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-01-15T23:45:00Z'));
    try {
      vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({ timeLogs: [{ ...log, timezone: 'Europe/Berlin', start_timestamp: '2025-01-15T23:15:00Z', end_timestamp: '2025-01-15T23:30:00Z' }], cursor });
      await loadData(true);
      expect(await getBalance('target_2025-01-16')).toMatchObject({ worked_minutes: 15 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('repairs old month indexes before loading timelogs while offline', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-01-01T02:00:00Z'));
    try {
      vi.mocked(isOnline).mockReturnValue(false);
      const database = await getDB();
      await database.put('timers', timer);
      await database.put('targets', { ...target, target_specs: [{ ...target.target_specs[0], starting_from: '2025-01-01', ending_at: '2025-01-01' }] });
      await database.put('timelogs', { ...log, timezone: 'Europe/Berlin', start_timestamp: '2024-12-31T23:30:00Z', end_timestamp: '2025-01-01T00:30:00Z', year: 2024, month: 12 });
      await database.put('settings', 2, 'timelog_date_index_v1');
      await loadData(true);
      expect(timeLogsStore.getState().items.has('log')).toBe(true);
      expect(await getBalance('target_2025-01-01')).toMatchObject({ worked_minutes: 60 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes running-log dates at local midnight without rewriting the timelog', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2025-01-15T22:59:00Z'));
    try {
      vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({ timeLogs: [{ ...log, timezone: 'Europe/Berlin', start_timestamp: '2025-01-15T22:00:00Z', end_timestamp: undefined }], cursor });
      await loadData(true);
      const original = await getTimeLog('log');
      expect(await getTimelogIdsForDate('2025-01-16')).toEqual([]);
      vi.setSystemTime(new Date('2025-01-15T23:01:00Z'));
      startBalanceUpdates('index-refresh');
      await vi.advanceTimersByTimeAsync(60000);
      await vi.waitFor(async () => {
        expect(await getTimelogIdsForDate('2025-01-16')).toEqual(['log']);
        expect(await getBalance('target_2025-01-15')).toMatchObject({ worked_minutes: 60 });
      });
      expect(await getTimeLog('log')).toEqual(original);
    } finally {
      stopBalanceUpdates('index-refresh');
      vi.useRealTimers();
    }
  });

  it('does not overwrite a stopped log still present in the in-memory active list', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    let recalculate: ReturnType<typeof vi.spyOn> | undefined;
    try {
      vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({ timeLogs: [{ ...log, end_timestamp: undefined }], cursor });
      await loadData(true);
      await saveTimeLog({ ...log, end_timestamp: '2025-01-15T11:00:00Z', updated_at: '2025-01-15T11:00:00Z' });
      const stopped = await getTimeLog('log');
      recalculate = vi.spyOn(balancesStore, 'ensureBalancesUpToDate');
      startBalanceUpdates('stale-active');
      await vi.advanceTimersByTimeAsync(60000);
      expect(await getTimeLog('log')).toEqual(stopped);
      expect(recalculate).not.toHaveBeenCalled();
    } finally {
      stopBalanceUpdates('stale-active');
      recalculate?.mockRestore();
      vi.useRealTimers();
    }
  });
});