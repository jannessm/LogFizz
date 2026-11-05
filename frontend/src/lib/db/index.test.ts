import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeLog } from '../../types';
import {
  getDB, saveTimeLog, deleteTimeLog, rebuildTimelogDateIndex,
  getTimelogIdsForDate, getTimeLogsByIds,
  getBalanceCalcMeta,
  getTimeLogsByYearMonth,
  ensureTimelogDateIndex,
  refreshTimelogDateIndex,
  getTimeLog,
} from './index';

const makeLog = (id: string, start = '2025-01-15T08:00:00Z', end = '2025-01-15T12:00:00Z'): TimeLog => ({
  id, user_id: 'user', timer_id: 'timer', type: 'normal', whole_day: false,
  start_timestamp: start, end_timestamp: end, timezone: 'America/New_York',
  apply_break_calculation: false, created_at: start, updated_at: start,
});

describe('timelog date index', () => {
  beforeEach(async () => {
    const database = await getDB();
    await database.clear('timelogs');
    await database.clear('timelogDateIndex');
    await database.clear('settings');
    await rebuildTimelogDateIndex();
  });

  it('preserves all IDs when same-day logs are saved concurrently', async () => {
    await Promise.all([saveTimeLog(makeLog('morning')), saveTimeLog(makeLog('afternoon'))]);
    expect((await getTimelogIdsForDate('2025-01-15')).sort()).toEqual(['afternoon', 'morning']);
  });

  it('extends the running log index across local midnight without modifying the log', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-01-15T22:45:00Z'));
    try {
      await saveTimeLog({ ...makeLog('running', '2025-01-15T22:30:00Z'), timezone: 'Europe/Berlin', end_timestamp: undefined });
      const original = await getTimeLog('running');
      expect(await getTimelogIdsForDate('2025-01-16')).toEqual([]);
      vi.setSystemTime(new Date('2025-01-15T23:15:00Z'));
      expect(await refreshTimelogDateIndex('running')).toEqual(original);
      expect(await getTimelogIdsForDate('2025-01-15')).toEqual(['running']);
      expect(await getTimelogIdsForDate('2025-01-16')).toEqual(['running']);
      await refreshTimelogDateIndex('running');
      expect(await getTimelogIdsForDate('2025-01-16')).toEqual(['running']);
      expect(await getTimeLog('running')).toEqual(original);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the newest persisted running log rather than an in-memory snapshot', async () => {
    const updated = { ...makeLog('edited'), end_timestamp: undefined, notes: 'newer edit', updated_at: '2025-01-16T00:00:00Z' };
    await saveTimeLog(updated);
    const persisted = await getTimeLog(updated.id);
    expect(await refreshTimelogDateIndex(updated.id)).toEqual(persisted);
    expect(await getTimeLog(updated.id)).toEqual(persisted);
  });

  it('does not refresh or resurrect stopped and deleted logs', async () => {
    await saveTimeLog(makeLog('stopped'));
    const stopped = await getTimeLog('stopped');
    const before = await getTimelogIdsForDate('2025-01-15');
    expect(await refreshTimelogDateIndex('stopped')).toBeUndefined();
    expect(await getTimeLog('stopped')).toEqual(stopped);
    expect(await getTimelogIdsForDate('2025-01-15')).toEqual(before);
    await deleteTimeLog(makeLog('stopped'));
    expect(await refreshTimelogDateIndex('stopped')).toBeUndefined();
    expect(await getTimeLog('stopped')).toBeUndefined();
    expect(await getTimelogIdsForDate('2025-01-15')).toEqual([]);
    await saveTimeLog({ ...makeLog('soft-deleted'), end_timestamp: undefined, deleted_at: '2025-01-16' });
    expect(await refreshTimelogDateIndex('soft-deleted')).toBeUndefined();
  });

  it('does not trust calculation metadata from the old algorithm', async () => {
    const database = await getDB();
    await database.put('settings', {
      schema_version: 1, user_id: 'user', targets: { target: { last_updated_day: '2025-01-15', updated_at: '2025-01-15' } },
    }, 'balance_calc_meta_v2');
    expect(await getBalanceCalcMeta()).toBeNull();
  });

  it('keeps index and logs consistent when saves overlap a full rebuild', async () => {
    await saveTimeLog(makeLog('existing'));
    await Promise.all([
      rebuildTimelogDateIndex(),
      saveTimeLog(makeLog('first')),
      saveTimeLog(makeLog('second')),
    ]);
    const ids = await getTimelogIdsForDate('2025-01-15');
    expect(ids.sort()).toEqual(['existing', 'first', 'second']);
    expect(await getTimeLogsByIds(ids)).toHaveLength(3);
  });

  it('indexes the local date without an empty local-midnight-ending day', async () => {
    await saveTimeLog(makeLog('midnight', '2025-01-16T04:00:00Z', '2025-01-16T05:00:00Z'));
    expect(await getTimelogIdsForDate('2025-01-14')).toEqual([]);
    expect(await getTimelogIdsForDate('2025-01-15')).toEqual(['midnight']);
    expect(await getTimelogIdsForDate('2025-01-16')).toEqual([]);
  });

  it('indexes a Berlin log just after midnight on January 15, not January 14', async () => {
    await saveTimeLog({ ...makeLog('berlin', '2025-01-14T23:30:00Z', '2025-01-15T00:30:00Z'), timezone: 'Europe/Berlin' });
    expect(await getTimelogIdsForDate('2025-01-14')).toEqual([]);
    expect(await getTimelogIdsForDate('2025-01-15')).toEqual(['berlin']);
  });

  it('uses the log timezone for month and year indexes across New Year', async () => {
    await saveTimeLog({ ...makeLog('new-year', '2024-12-31T23:30:00Z', '2025-01-01T00:30:00Z'), timezone: 'Europe/Berlin' });
    expect((await getTimeLogsByYearMonth(2025, 1)).map(log => log.id)).toEqual(['new-year']);
    expect(await getTimeLogsByYearMonth(2024, 12)).toEqual([]);
  });

  it('repairs UTC-derived date and month indexes on upgrade', async () => {
    const database = await getDB();
    await database.put('timelogs', { ...makeLog('legacy', '2024-12-31T23:30:00Z', '2025-01-01T00:30:00Z'), timezone: 'Europe/Berlin', year: 2024, month: 12 });
    await database.put('settings', 2, 'timelog_date_index_v1');
    await ensureTimelogDateIndex();
    expect((await getTimeLogsByYearMonth(2025, 1)).map(log => log.id)).toEqual(['legacy']);
    expect(await getTimelogIdsForDate('2024-12-31')).toEqual([]);
    expect(await getTimelogIdsForDate('2025-01-01')).toEqual(['legacy']);
  });

  it('removes only the deleted log when another same-day log changes', async () => {
    await saveTimeLog(makeLog('deleted'));
    await saveTimeLog(makeLog('kept'));
    await Promise.all([deleteTimeLog(makeLog('deleted')), saveTimeLog(makeLog('kept'))]);
    expect(await getTimelogIdsForDate('2025-01-15')).toEqual(['kept']);
  });
});