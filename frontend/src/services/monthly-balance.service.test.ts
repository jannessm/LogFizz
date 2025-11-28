import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MonthlyBalanceService } from './monthly-balance.service';
import type { DailyTarget, TimeLog, Button, MonthlyBalance } from '../types';
import * as db from '../lib/db';

// Mock the db module
vi.mock('../lib/db', () => ({
  getAllTargets: vi.fn(),
  getAllTimeLogs: vi.fn(),
  getAllButtons: vi.fn(),
  saveMonthlyBalance: vi.fn(),
  getMonthlyBalance: vi.fn(),
  deleteMonthlyBalance: vi.fn(),
}));

// Helper to create a mock button
const createMockButton = (id: string, targetId: string, autoSubtractBreaks = false): Button => ({
  id,
  user_id: 'user-1',
  name: 'Work Button',
  target_id: targetId,
  auto_subtract_breaks: autoSubtractBreaks,
  position: 0,
  created_at: '2025-01-01T00:00:00.000Z',
});

describe('MonthlyBalanceService', () => {
  let service: MonthlyBalanceService;

  beforeEach(() => {
    service = new MonthlyBalanceService();
    vi.clearAllMocks();
  });

  describe('calculateMonthlyBalance', () => {
    it('should calculate correct worked and due minutes for a basic scenario', async () => {
      const targetId = 'target-1';
      const buttonId = 'button-1';

      // Mock target: Monday only, 8 hours/day, starting Jan 1 2025
      const target: DailyTarget = {
        id: targetId,
        user_id: 'user-1',
        name: 'Test Target',
        duration_minutes: [480], // 8 hours
        weekdays: [1], // Monday only
        exclude_holidays: false,
        starting_from: '2025-01-01T00:00:00.000Z',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      // Mock button
      const button = createMockButton(buttonId, targetId);

      // Mock time logs: Monday Jan 6, 2025, 9:00-17:00 (8 hours)
      const timeLogs: TimeLog[] = [
        {
          id: 'log-1',
          user_id: 'user-1',
          button_id: buttonId,
          type: 'start',
          timestamp: '2025-01-06T09:00:00.000Z',
          timezone: 'UTC',
          apply_break_calculation: false,
          is_manual: false,
          created_at: '2025-01-06T09:00:00.000Z',
          updated_at: '2025-01-06T09:00:00.000Z',
        },
        {
          id: 'log-2',
          user_id: 'user-1',
          button_id: buttonId,
          type: 'stop',
          timestamp: '2025-01-06T17:00:00.000Z',
          timezone: 'UTC',
          apply_break_calculation: false,
          is_manual: false,
          created_at: '2025-01-06T17:00:00.000Z',
          updated_at: '2025-01-06T17:00:00.000Z',
        },
      ];

      // Setup mocks
      vi.mocked(db.getAllTargets).mockResolvedValue([target]);
      vi.mocked(db.getAllButtons).mockResolvedValue([button]);
      vi.mocked(db.getAllTimeLogs).mockResolvedValue(timeLogs);
      vi.mocked(db.getMonthlyBalance).mockResolvedValue(undefined);
      vi.mocked(db.saveMonthlyBalance).mockResolvedValue(undefined);

      // Calculate balance for January 2025
      const result = await service.calculateMonthlyBalance(targetId, 2025, 1);

      expect(result).toBeDefined();
      expect(result?.worked_minutes).toBe(480); // 8 hours worked
      // January 2025 has 4 Mondays (6, 13, 20, 27)
      expect(result?.due_minutes).toBe(1920); // 4 * 480
      // Balance = worked - due = 480 - 1920 = -1440
      expect(result?.balance_minutes).toBe(-1440);
    });

    it('should return null for target without starting_from', async () => {
      const targetId = 'target-1';

      const target: DailyTarget = {
        id: targetId,
        user_id: 'user-1',
        name: 'Test Target',
        duration_minutes: [480],
        weekdays: [1],
        exclude_holidays: false,
        starting_from: undefined,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      vi.mocked(db.getAllTargets).mockResolvedValue([target]);
      vi.mocked(db.deleteMonthlyBalance).mockResolvedValue(undefined);

      const result = await service.calculateMonthlyBalance(targetId, 2025, 1);

      expect(result).toBeNull();
      expect(db.deleteMonthlyBalance).toHaveBeenCalledWith('target-1-2025-1');
    });

    it('should include cumulative balance from previous month', async () => {
      const targetId = 'target-1';
      const buttonId = 'button-1';

      const target: DailyTarget = {
        id: targetId,
        user_id: 'user-1',
        name: 'Test Target',
        duration_minutes: [480],
        weekdays: [1], // Monday only
        exclude_holidays: false,
        starting_from: '2024-12-01T00:00:00.000Z',
        created_at: '2024-12-01T00:00:00.000Z',
        updated_at: '2024-12-01T00:00:00.000Z',
      };

      const button = createMockButton(buttonId, targetId);

      // Time logs for January only
      const timeLogs: TimeLog[] = [
        {
          id: 'log-1',
          user_id: 'user-1',
          button_id: buttonId,
          type: 'start',
          timestamp: '2025-01-06T09:00:00.000Z',
          timezone: 'UTC',
          apply_break_calculation: false,
          is_manual: false,
          created_at: '2025-01-06T09:00:00.000Z',
          updated_at: '2025-01-06T09:00:00.000Z',
        },
        {
          id: 'log-2',
          user_id: 'user-1',
          button_id: buttonId,
          type: 'stop',
          timestamp: '2025-01-06T17:00:00.000Z',
          timezone: 'UTC',
          apply_break_calculation: false,
          is_manual: false,
          created_at: '2025-01-06T17:00:00.000Z',
          updated_at: '2025-01-06T17:00:00.000Z',
        },
      ];

      // Mock previous month balance (December 2024)
      const previousBalance: MonthlyBalance = {
        id: 'target-1-2024-12',
        user_id: 'user-1',
        target_id: targetId,
        year: 2024,
        month: 12,
        worked_minutes: 3000,
        due_minutes: 2400,
        balance_minutes: 600, // Previous cumulative balance
        exclude_holidays: false,
        created_at: '2024-12-31T00:00:00.000Z',
        updated_at: '2024-12-31T00:00:00.000Z',
      };

      vi.mocked(db.getAllTargets).mockResolvedValue([target]);
      vi.mocked(db.getAllButtons).mockResolvedValue([button]);
      vi.mocked(db.getAllTimeLogs).mockResolvedValue(timeLogs);
      vi.mocked(db.getMonthlyBalance).mockImplementation(async (id: string) => {
        if (id === 'target-1-2024-12') {
          return previousBalance;
        }
        return undefined;
      });
      vi.mocked(db.saveMonthlyBalance).mockResolvedValue(undefined);

      const result = await service.calculateMonthlyBalance(targetId, 2025, 1);

      expect(result).toBeDefined();
      expect(result?.worked_minutes).toBe(480); // This month: 8 hours
      expect(result?.due_minutes).toBe(1920); // This month: 4 Mondays * 8 hours
      // This month balance = 480 - 1920 = -1440
      // Cumulative = previous (600) + this month (-1440) = -840
      expect(result?.balance_minutes).toBe(-840);
    });

    it('should respect starting_from date for due minutes calculation', async () => {
      const targetId = 'target-1';
      const buttonId = 'button-1';

      // Target starts mid-month (Jan 15, 2025)
      const target: DailyTarget = {
        id: targetId,
        user_id: 'user-1',
        name: 'Mid-Month Target',
        duration_minutes: [480],
        weekdays: [1], // Monday only
        exclude_holidays: false,
        starting_from: '2025-01-15T00:00:00.000Z',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      const button = createMockButton(buttonId, targetId);

      const timeLogs: TimeLog[] = [
        {
          id: 'log-1',
          user_id: 'user-1',
          button_id: buttonId,
          type: 'start',
          timestamp: '2025-01-20T09:00:00.000Z',
          timezone: 'UTC',
          apply_break_calculation: false,
          is_manual: false,
          created_at: '2025-01-20T09:00:00.000Z',
          updated_at: '2025-01-20T09:00:00.000Z',
        },
        {
          id: 'log-2',
          user_id: 'user-1',
          button_id: buttonId,
          type: 'stop',
          timestamp: '2025-01-20T17:00:00.000Z',
          timezone: 'UTC',
          apply_break_calculation: false,
          is_manual: false,
          created_at: '2025-01-20T17:00:00.000Z',
          updated_at: '2025-01-20T17:00:00.000Z',
        },
      ];

      vi.mocked(db.getAllTargets).mockResolvedValue([target]);
      vi.mocked(db.getAllButtons).mockResolvedValue([button]);
      vi.mocked(db.getAllTimeLogs).mockResolvedValue(timeLogs);
      vi.mocked(db.getMonthlyBalance).mockResolvedValue(undefined);
      vi.mocked(db.saveMonthlyBalance).mockResolvedValue(undefined);

      const result = await service.calculateMonthlyBalance(targetId, 2025, 1);

      expect(result).toBeDefined();
      expect(result?.worked_minutes).toBe(480);
      // Only Mondays on or after Jan 15: 20, 27 = 2 Mondays
      expect(result?.due_minutes).toBe(960); // 2 * 480
      expect(result?.balance_minutes).toBe(-480); // 480 - 960
    });

    it('should apply auto_subtract_breaks when enabled', async () => {
      const targetId = 'target-1';
      const buttonId = 'button-1';

      const target: DailyTarget = {
        id: targetId,
        user_id: 'user-1',
        name: 'Test Target',
        duration_minutes: [480],
        weekdays: [1],
        exclude_holidays: false,
        starting_from: '2025-01-01T00:00:00.000Z',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      // Button with auto_subtract_breaks enabled
      const button = createMockButton(buttonId, targetId, true);

      // Time logs: Monday Jan 6, 2025, 8:00-18:00 (10 hours)
      const timeLogs: TimeLog[] = [
        {
          id: 'log-1',
          user_id: 'user-1',
          button_id: buttonId,
          type: 'start',
          timestamp: '2025-01-06T08:00:00.000Z',
          timezone: 'UTC',
          apply_break_calculation: false,
          is_manual: false,
          created_at: '2025-01-06T08:00:00.000Z',
          updated_at: '2025-01-06T08:00:00.000Z',
        },
        {
          id: 'log-2',
          user_id: 'user-1',
          button_id: buttonId,
          type: 'stop',
          timestamp: '2025-01-06T18:00:00.000Z',
          timezone: 'UTC',
          apply_break_calculation: false,
          is_manual: false,
          created_at: '2025-01-06T18:00:00.000Z',
          updated_at: '2025-01-06T18:00:00.000Z',
        },
      ];

      vi.mocked(db.getAllTargets).mockResolvedValue([target]);
      vi.mocked(db.getAllButtons).mockResolvedValue([button]);
      vi.mocked(db.getAllTimeLogs).mockResolvedValue(timeLogs);
      vi.mocked(db.getMonthlyBalance).mockResolvedValue(undefined);
      vi.mocked(db.saveMonthlyBalance).mockResolvedValue(undefined);

      const result = await service.calculateMonthlyBalance(targetId, 2025, 1);

      expect(result).toBeDefined();
      // 10 hours = 600 minutes, but with 9+ hours worked, 45 min break is subtracted
      // 600 - 45 = 555 minutes
      expect(result?.worked_minutes).toBe(555);
    });
  });

  describe('checkAndRecalculateMissingBalances', () => {
    it('should recalculate missing balances for targets with starting_from', async () => {
      const targetId = 'target-1';
      const buttonId = 'button-1';

      // Target started 3 months ago
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const target: DailyTarget = {
        id: targetId,
        user_id: 'user-1',
        name: 'Test Target',
        duration_minutes: [480],
        weekdays: [1],
        exclude_holidays: false,
        starting_from: threeMonthsAgo.toISOString(),
        created_at: threeMonthsAgo.toISOString(),
        updated_at: threeMonthsAgo.toISOString(),
      };

      const button = createMockButton(buttonId, targetId);

      vi.mocked(db.getAllTargets).mockResolvedValue([target]);
      vi.mocked(db.getAllButtons).mockResolvedValue([button]);
      vi.mocked(db.getAllTimeLogs).mockResolvedValue([]);
      vi.mocked(db.getMonthlyBalance).mockResolvedValue(undefined); // No existing balances
      vi.mocked(db.saveMonthlyBalance).mockResolvedValue(undefined);

      await service.checkAndRecalculateMissingBalances();

      // Should have been called at least 3 times (for 3 months + current month)
      expect(db.saveMonthlyBalance).toHaveBeenCalled();
      expect(vi.mocked(db.saveMonthlyBalance).mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should skip targets without starting_from', async () => {
      const target: DailyTarget = {
        id: 'target-1',
        user_id: 'user-1',
        name: 'Test Target',
        duration_minutes: [480],
        weekdays: [1],
        exclude_holidays: false,
        starting_from: undefined,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      };

      vi.mocked(db.getAllTargets).mockResolvedValue([target]);

      await service.checkAndRecalculateMissingBalances();

      // Should not attempt to save any balances
      expect(db.saveMonthlyBalance).not.toHaveBeenCalled();
    });
  });

  describe('recalculateAffectedMonthlyBalances', () => {
    it('should recalculate from earliest affected month to current month', async () => {
      const targetId = 'target-1';
      const buttonId = 'button-1';

      const target: DailyTarget = {
        id: targetId,
        user_id: 'user-1',
        name: 'Test Target',
        duration_minutes: [480],
        weekdays: [1],
        exclude_holidays: false,
        starting_from: '2024-12-01T00:00:00.000Z',
        created_at: '2024-12-01T00:00:00.000Z',
        updated_at: '2024-12-01T00:00:00.000Z',
      };

      const button = createMockButton(buttonId, targetId);

      // Time logs from December 2024
      const timeLogs = [
        {
          timestamp: '2024-12-02T09:00:00.000Z',
          button_id: buttonId,
        },
      ];

      vi.mocked(db.getAllTargets).mockResolvedValue([target]);
      vi.mocked(db.getAllButtons).mockResolvedValue([button]);
      vi.mocked(db.getAllTimeLogs).mockResolvedValue([]);
      vi.mocked(db.getMonthlyBalance).mockResolvedValue(undefined);
      vi.mocked(db.saveMonthlyBalance).mockResolvedValue(undefined);

      await service.recalculateAffectedMonthlyBalances(timeLogs);

      // Should recalculate December 2024 and all months up to now
      expect(db.saveMonthlyBalance).toHaveBeenCalled();
      // At minimum should have December 2024 and January 2025
      expect(vi.mocked(db.saveMonthlyBalance).mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should do nothing when no time logs provided', async () => {
      await service.recalculateAffectedMonthlyBalances([]);

      expect(db.saveMonthlyBalance).not.toHaveBeenCalled();
    });
  });
});
