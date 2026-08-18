import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module before importing sync service
vi.mock('../lib/db', () => ({
  addToSyncQueue: vi.fn().mockResolvedValue(undefined),
  getUnsyncedItems: vi.fn().mockResolvedValue([]),
  markItemSynced: vi.fn().mockResolvedValue(undefined),
  deleteFromSyncQueue: vi.fn().mockResolvedValue(undefined),
  saveTimer: vi.fn().mockResolvedValue(undefined),
  saveTimeLog: vi.fn().mockResolvedValue(undefined),
  saveTarget: vi.fn().mockResolvedValue(undefined),
  saveBalance: vi.fn().mockResolvedValue(undefined),
  deleteTimer: vi.fn().mockResolvedValue(undefined),
  deleteTimeLog: vi.fn().mockResolvedValue(undefined),
  deleteTarget: vi.fn().mockResolvedValue(undefined),
  deleteBalance: vi.fn().mockResolvedValue(undefined),
  getSyncCursor: vi.fn().mockResolvedValue(undefined),
  saveSyncCursor: vi.fn().mockResolvedValue(undefined),
  getUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com' }),
  getBalanceCalcMeta: vi.fn().mockResolvedValue(null),
  clearBalanceCalcMeta: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./api', () => ({
  timerApi: {
    getSyncChanges: vi.fn().mockResolvedValue({ timers: [], cursor: '2025-01-01T00:00:00Z' }),
    pushSyncChanges: vi.fn().mockResolvedValue({ cursor: '2025-01-01T00:00:00Z' }),
  },
  timeLogApi: {
    getSyncChanges: vi.fn().mockResolvedValue({ timeLogs: [], cursor: '2025-01-01T00:00:00Z' }),
    pushSyncChanges: vi.fn().mockResolvedValue({ cursor: '2025-01-01T00:00:00Z' }),
  },
  targetApi: {
    getSyncChanges: vi.fn().mockResolvedValue({ targets: [], cursor: '2025-01-01T00:00:00Z' }),
    pushSyncChanges: vi.fn().mockResolvedValue({ cursor: '2025-01-01T00:00:00Z' }),
  },
  balanceApi: {
    getSyncChanges: vi.fn().mockResolvedValue({ balances: [], cursor: '2025-01-01T00:00:00Z' }),
    pushSyncChanges: vi.fn().mockResolvedValue({ cursor: '2025-01-01T00:00:00Z' }),
  },
  isOnline: vi.fn().mockReturnValue(true),
}));

import * as db from '../lib/db';
import { balanceApi, timeLogApi, targetApi } from './api';
import { SyncService } from './sync';

describe('SyncService - Balance sync robustness', () => {
  let syncService: SyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    syncService = new SyncService();
  });

  describe('balance pull is skipped when local calc metadata exists', () => {
    it('should pull balances from server on first sync (no local metadata)', async () => {
      vi.mocked(db.getBalanceCalcMeta).mockResolvedValue(null);
      vi.mocked(balanceApi.getSyncChanges).mockResolvedValue({
        balances: [
          { id: 'target1_2025-01', target_id: 'target1', date: '2025-01', due_minutes: 9600, worked_minutes: 8000, cumulative_minutes: -1600, sick_days: 0, holidays: 0, business_trip: 0, child_sick: 0, homeoffice: 0, normal_days: 0, worked_days: 20, user_id: 'user-1', created_at: '2025-01-01', updated_at: '2025-01-01' },
        ],
        cursor: '2025-02-01T00:00:00Z',
      });

      await syncService.sync('balance');

      expect(balanceApi.getSyncChanges).toHaveBeenCalled();
      expect(db.saveBalance).toHaveBeenCalledTimes(1);
    });

    it('should NOT pull balances from server when local calc metadata exists', async () => {
      vi.mocked(db.getBalanceCalcMeta).mockResolvedValue({
        schema_version: 1,
        user_id: 'user-1',
        targets: {
          'target1': { last_updated_day: '2025-01-31', updated_at: '2025-01-31T00:00:00Z' },
        },
      });

      await syncService.sync('balance');

      // Balance API should NOT be called for pull since metadata exists
      expect(balanceApi.getSyncChanges).not.toHaveBeenCalled();
      expect(db.saveBalance).not.toHaveBeenCalled();
    });

    it('should still push local balance changes even when metadata exists', async () => {
      vi.mocked(db.getBalanceCalcMeta).mockResolvedValue({
        schema_version: 1,
        user_id: 'user-1',
        targets: {
          'target1': { last_updated_day: '2025-01-31', updated_at: '2025-01-31T00:00:00Z' },
        },
      });

      vi.mocked(db.getUnsyncedItems).mockResolvedValue([
        {
          id: 'sync-1',
          type: 'balance',
          data: { id: 'target1_2025-01', target_id: 'target1', date: '2025-01', due_minutes: 9600, worked_minutes: 9000, cumulative_minutes: -600, sick_days: 0, holidays: 0, business_trip: 0, child_sick: 0, homeoffice: 0, normal_days: 0, worked_days: 20, user_id: 'user-1' },
          synced: false,
        },
      ]);

      vi.mocked(balanceApi.pushSyncChanges).mockResolvedValue({
        saved: [{ id: 'target1_2025-01', target_id: 'target1', date: '2025-01', due_minutes: 9600, worked_minutes: 9000, cumulative_minutes: -600, sick_days: 0, holidays: 0, business_trip: 0, child_sick: 0, homeoffice: 0, normal_days: 0, worked_days: 20, user_id: 'user-1', created_at: '2025-01-01', updated_at: '2025-01-01' }],
        cursor: '2025-02-01T00:00:00Z',
      });

      await syncService.sync('balance');

      // Push should still happen
      expect(balanceApi.pushSyncChanges).toHaveBeenCalled();
    });
  });

  describe('balance calc metadata is invalidated when source data changes', () => {
    it('should clear balance calc metadata when new timelogs are pulled from server', async () => {
      vi.mocked(db.getBalanceCalcMeta).mockResolvedValue({
        schema_version: 1,
        user_id: 'user-1',
        targets: {
          'target1': { last_updated_day: '2025-01-31', updated_at: '2025-01-31T00:00:00Z' },
        },
      });

      // Server returns new timelogs
      vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({
        timeLogs: [
          { id: 'tl-1', timer_id: 'timer-1', start_timestamp: '2025-01-15T08:00:00Z', end_timestamp: '2025-01-15T17:00:00Z', type: 'normal', whole_day: false, timezone: 'Europe/Berlin', apply_break_calculation: true, updated_at: '2025-01-15T17:00:00Z', created_at: '2025-01-15T08:00:00Z' },
        ],
        cursor: '2025-02-01T00:00:00Z',
      });

      await syncService.sync('all');

      // Balance calc metadata should be cleared
      expect(db.clearBalanceCalcMeta).toHaveBeenCalled();
    });

    it('should clear balance calc metadata when targets are pulled from server', async () => {
      vi.mocked(db.getBalanceCalcMeta).mockResolvedValue({
        schema_version: 1,
        user_id: 'user-1',
        targets: {
          'target1': { last_updated_day: '2025-01-31', updated_at: '2025-01-31T00:00:00Z' },
        },
      });

      // Server returns new targets
      vi.mocked(targetApi.getSyncChanges).mockResolvedValue({
        targets: [
          { id: 'target1', name: 'Updated Target', target_specs: [], updated_at: '2025-01-20T00:00:00Z', created_at: '2025-01-01T00:00:00Z' },
        ],
        cursor: '2025-02-01T00:00:00Z',
      });

      await syncService.sync('all');

      // Balance calc metadata should be cleared
      expect(db.clearBalanceCalcMeta).toHaveBeenCalled();
    });

    it('should NOT clear balance calc metadata when no new timelogs or targets are pulled', async () => {
      vi.mocked(db.getBalanceCalcMeta).mockResolvedValue({
        schema_version: 1,
        user_id: 'user-1',
        targets: {
          'target1': { last_updated_day: '2025-01-31', updated_at: '2025-01-31T00:00:00Z' },
        },
      });

      // Server returns no changes
      vi.mocked(timeLogApi.getSyncChanges).mockResolvedValue({
        timeLogs: [],
        cursor: '2025-02-01T00:00:00Z',
      });
      vi.mocked(targetApi.getSyncChanges).mockResolvedValue({
        targets: [],
        cursor: '2025-02-01T00:00:00Z',
      });

      await syncService.sync('all');

      // Balance calc metadata should NOT be cleared
      expect(db.clearBalanceCalcMeta).not.toHaveBeenCalled();
    });
  });
});
