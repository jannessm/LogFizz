import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TimeLog, Button } from '../types';

// Helper function to calculate duration with break rules
function calculateDurationWithBreaks(startTs: string, endTs: string, applyBreaks: boolean): number {
  const start = new Date(startTs).getTime();
  const end = new Date(endTs).getTime();
  let minutes = Math.round((end - start) / (1000 * 60));
  
  if (applyBreaks) {
    if (minutes >= 9 * 60) {
      minutes -= 45;
    } else if (minutes >= 6 * 60) {
      minutes -= 30;
    }
  }
  
  return Math.max(0, minutes);
}

// Mock the db module
vi.mock('../lib/db', () => ({
  getAllTimeLogs: vi.fn(),
  saveTimeLog: vi.fn(),
  deleteTimeLog: vi.fn(),
  getButton: vi.fn(),
  addToSyncQueue: vi.fn(),
}));

// Mock the sync service
vi.mock('../services/sync.service', () => ({
  syncService: {
    queueTimeLogUpdate: vi.fn().mockResolvedValue(undefined),
    queueTimeLogCreation: vi.fn().mockResolvedValue(undefined),
    queueTimeLogDeletion: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock monthly balance service
vi.mock('../services/monthly-balance.service', () => ({
  MonthlyBalanceService: vi.fn().mockImplementation(() => ({
    recalculateBalancesForTimeLogs: vi.fn().mockResolvedValue(undefined),
  })),
}));

import * as db from '../lib/db';
import { timeLogsStore } from './timelogs';
import { get } from 'svelte/store';

describe('timeLogsStore - Break Calculation', () => {
  let lastSavedTimeLog: TimeLog | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    lastSavedTimeLog = null;
    
    // Mock saveTimeLog to simulate the duration calculation that now happens in db/index.ts
    vi.mocked(db.saveTimeLog).mockImplementation(async (timelog: TimeLog) => {
      // Simulate the duration calculation that happens in the real saveTimeLog
      let finalTimelog = timelog;
      if (timelog.start_timestamp && timelog.end_timestamp) {
        const applyBreaks = timelog.apply_break_calculation ?? false;
        const duration = calculateDurationWithBreaks(
          timelog.start_timestamp,
          timelog.end_timestamp,
          applyBreaks
        );
        // Create a new timelog with the calculated duration
        finalTimelog = {
          ...timelog,
          duration_minutes: duration,
        };
      }
      // Store for test verification
      lastSavedTimeLog = finalTimelog;
      return Promise.resolve();
    });
  });

  /**
   * Test that verifies breaks are subtracted when calculating duration during timelog updates
   * 
   * This test specifically verifies the break calculation functionality when editing a timelog.
   * German break rules:
   * - 6+ hours worked: 30 minutes break subtracted
   * - 9+ hours worked: 45 minutes break subtracted
   * 
   * The break calculation is controlled by the apply_break_calculation flag on the TimeLog,
   * which is derived from the button's auto_subtract_breaks setting.
   */
  describe('update with break calculation', () => {
    it('should subtract 45 min break for 10-hour session when apply_break_calculation is true', async () => {
      const existingTimeLog: TimeLog = {
        id: 'log-1',
        user_id: 'user-1',
        button_id: 'button-1',
        start_timestamp: '2024-12-04T08:00:00Z',
        end_timestamp: '2024-12-04T17:00:00Z', // 9 hours
        duration_minutes: 495, // 9 hours (540 min) - 45 min = 495 min
        timezone: 'UTC',
        apply_break_calculation: true,
        notes: 'Work session',
        is_manual: false,
        created_at: '2024-12-04T08:00:00Z',
        updated_at: '2024-12-04T17:00:00Z',
      };

      vi.mocked(db.getAllTimeLogs).mockResolvedValue([existingTimeLog]);

      // Update to extend the end time by 1 hour (making it 10 hours total)
      await timeLogsStore.update('log-1', {
        end_timestamp: '2024-12-04T18:00:00Z', // 10 hours total
      });

      // Verify saveTimeLog was called with the correct duration
      expect(db.saveTimeLog).toHaveBeenCalled();
      const savedTimeLog = lastSavedTimeLog!;
      
      // 10 hours = 600 minutes
      // With apply_break_calculation: true and >= 9 hours, subtract 45 min
      // Expected: 600 - 45 = 555 minutes
      expect(savedTimeLog.duration_minutes).toBe(555);
      expect(savedTimeLog.apply_break_calculation).toBe(true);
    });

    it('should subtract 30 min break for 7-hour session when apply_break_calculation is true', async () => {
      const existingTimeLog: TimeLog = {
        id: 'log-2',
        user_id: 'user-1',
        button_id: 'button-1',
        start_timestamp: '2024-12-04T08:00:00Z',
        end_timestamp: '2024-12-04T18:00:00Z', // 10 hours
        duration_minutes: 555, // 10 hours (600 min) - 45 min = 555 min
        timezone: 'UTC',
        apply_break_calculation: true,
        notes: 'Long work session',
        is_manual: false,
        created_at: '2024-12-04T08:00:00Z',
        updated_at: '2024-12-04T18:00:00Z',
      };

      vi.mocked(db.getAllTimeLogs).mockResolvedValue([existingTimeLog]);

      // Update to reduce the end time (making it 7 hours total)
      await timeLogsStore.update('log-2', {
        end_timestamp: '2024-12-04T15:00:00Z', // 7 hours total
      });

      // Verify saveTimeLog was called with the correct duration
      expect(db.saveTimeLog).toHaveBeenCalled();
      const savedTimeLog = lastSavedTimeLog!;
      
      // 7 hours = 420 minutes
      // With apply_break_calculation: true and >= 6 hours but < 9 hours, subtract 30 min
      // Expected: 420 - 30 = 390 minutes
      expect(savedTimeLog.duration_minutes).toBe(390);
      expect(savedTimeLog.apply_break_calculation).toBe(true);
    });

    it('should not subtract breaks for 10-hour session when apply_break_calculation is false', async () => {
      const existingTimeLog: TimeLog = {
        id: 'log-3',
        user_id: 'user-1',
        button_id: 'button-2',
        start_timestamp: '2024-12-04T08:00:00Z',
        end_timestamp: '2024-12-04T17:00:00Z', // 9 hours
        duration_minutes: 540, // 9 hours (540 min) - no breaks
        timezone: 'UTC',
        apply_break_calculation: false, // No break calculation
        notes: 'Study session',
        is_manual: false,
        created_at: '2024-12-04T08:00:00Z',
        updated_at: '2024-12-04T17:00:00Z',
      };

      vi.mocked(db.getAllTimeLogs).mockResolvedValue([existingTimeLog]);

      // Update to extend the end time by 1 hour (making it 10 hours total)
      await timeLogsStore.update('log-3', {
        end_timestamp: '2024-12-04T18:00:00Z', // 10 hours total
      });

      // Verify saveTimeLog was called with the correct duration
      expect(db.saveTimeLog).toHaveBeenCalled();
      const savedTimeLog = lastSavedTimeLog!;
      
      // 10 hours = 600 minutes
      // With apply_break_calculation: false, no break subtraction
      // Expected: 600 minutes (no subtraction)
      expect(savedTimeLog.duration_minutes).toBe(600);
      expect(savedTimeLog.apply_break_calculation).toBe(false);
    });

    it('should preserve apply_break_calculation flag from existing timelog', async () => {
      const existingTimeLog: TimeLog = {
        id: 'log-4',
        user_id: 'user-1',
        button_id: 'button-1',
        start_timestamp: '2024-12-04T08:00:00Z',
        end_timestamp: '2024-12-04T12:00:00Z', // 4 hours
        duration_minutes: 240, // 4 hours - no break threshold reached
        timezone: 'UTC',
        apply_break_calculation: true, // Flag is set, but no breaks applied yet
        notes: 'Short session',
        is_manual: false,
        created_at: '2024-12-04T08:00:00Z',
        updated_at: '2024-12-04T12:00:00Z',
      };

      vi.mocked(db.getAllTimeLogs).mockResolvedValue([existingTimeLog]);

      // Update to extend beyond 6 hours (triggering first break rule)
      await timeLogsStore.update('log-4', {
        end_timestamp: '2024-12-04T15:00:00Z', // 7 hours total
      });

      // Verify saveTimeLog was called with the correct duration
      expect(db.saveTimeLog).toHaveBeenCalled();
      const savedTimeLog = lastSavedTimeLog!;
      
      // 7 hours = 420 minutes
      // With apply_break_calculation: true and >= 6 hours, subtract 30 min
      // Expected: 420 - 30 = 390 minutes
      expect(savedTimeLog.duration_minutes).toBe(390);
      expect(savedTimeLog.apply_break_calculation).toBe(true);
    });

    it('should handle edge case: exactly 6 hours triggers 30 min break', async () => {
      const existingTimeLog: TimeLog = {
        id: 'log-5',
        user_id: 'user-1',
        button_id: 'button-1',
        start_timestamp: '2024-12-04T08:00:00Z',
        end_timestamp: '2024-12-04T13:59:00Z', // Just under 6 hours
        duration_minutes: 359, // 5:59 - no break
        timezone: 'UTC',
        apply_break_calculation: true,
        notes: 'Almost 6 hours',
        is_manual: false,
        created_at: '2024-12-04T08:00:00Z',
        updated_at: '2024-12-04T13:59:00Z',
      };

      vi.mocked(db.getAllTimeLogs).mockResolvedValue([existingTimeLog]);

      // Update to exactly 6 hours
      await timeLogsStore.update('log-5', {
        end_timestamp: '2024-12-04T14:00:00Z', // Exactly 6 hours
      });

      // Verify saveTimeLog was called with the correct duration
      expect(db.saveTimeLog).toHaveBeenCalled();
      const savedTimeLog = lastSavedTimeLog!;
      
      // 6 hours = 360 minutes
      // With apply_break_calculation: true and >= 6 hours, subtract 30 min
      // Expected: 360 - 30 = 330 minutes
      expect(savedTimeLog.duration_minutes).toBe(330);
      expect(savedTimeLog.apply_break_calculation).toBe(true);
    });

    it('should handle edge case: exactly 9 hours triggers 45 min break', async () => {
      const existingTimeLog: TimeLog = {
        id: 'log-6',
        user_id: 'user-1',
        button_id: 'button-1',
        start_timestamp: '2024-12-04T08:00:00Z',
        end_timestamp: '2024-12-04T16:59:00Z', // Just under 9 hours
        duration_minutes: 509, // 8:59 - 30 min break = 509 min
        timezone: 'UTC',
        apply_break_calculation: true,
        notes: 'Almost 9 hours',
        is_manual: false,
        created_at: '2024-12-04T08:00:00Z',
        updated_at: '2024-12-04T16:59:00Z',
      };

      vi.mocked(db.getAllTimeLogs).mockResolvedValue([existingTimeLog]);

      // Update to exactly 9 hours
      await timeLogsStore.update('log-6', {
        end_timestamp: '2024-12-04T17:00:00Z', // Exactly 9 hours
      });

      // Verify saveTimeLog was called with the correct duration
      expect(db.saveTimeLog).toHaveBeenCalled();
      const savedTimeLog = lastSavedTimeLog!;
      
      // 9 hours = 540 minutes
      // With apply_break_calculation: true and >= 9 hours, subtract 45 min
      // Expected: 540 - 45 = 495 minutes
      expect(savedTimeLog.duration_minutes).toBe(495);
      expect(savedTimeLog.apply_break_calculation).toBe(true);
    });

    it('should update both start and end timestamps correctly with break calculation', async () => {
      const existingTimeLog: TimeLog = {
        id: 'log-7',
        user_id: 'user-1',
        button_id: 'button-1',
        start_timestamp: '2024-12-04T08:00:00Z',
        end_timestamp: '2024-12-04T17:00:00Z', // 9 hours
        duration_minutes: 495, // 9 hours - 45 min = 495 min
        timezone: 'UTC',
        apply_break_calculation: true,
        notes: 'Full day',
        is_manual: false,
        created_at: '2024-12-04T08:00:00Z',
        updated_at: '2024-12-04T17:00:00Z',
      };

      vi.mocked(db.getAllTimeLogs).mockResolvedValue([existingTimeLog]);

      // Update both start and end times (shift by 1 hour, keeping 9 hour duration)
      await timeLogsStore.update('log-7', {
        start_timestamp: '2024-12-04T09:00:00Z',
        end_timestamp: '2024-12-04T18:00:00Z',
      });

      // Verify saveTimeLog was called with the correct duration
      expect(db.saveTimeLog).toHaveBeenCalled();
      const savedTimeLog = lastSavedTimeLog!;
      
      // Still 9 hours = 540 minutes
      // With apply_break_calculation: true and >= 9 hours, subtract 45 min
      // Expected: 540 - 45 = 495 minutes
      expect(savedTimeLog.duration_minutes).toBe(495);
      expect(savedTimeLog.start_timestamp).toBe('2024-12-04T09:00:00Z');
      expect(savedTimeLog.end_timestamp).toBe('2024-12-04T18:00:00Z');
      expect(savedTimeLog.apply_break_calculation).toBe(true);
    });
  });

  describe('stopTimer with break calculation', () => {
    it('should apply break calculation when stopping a timer', async () => {
      const runningTimer: TimeLog = {
        id: 'timer-1',
        user_id: 'user-1',
        button_id: 'button-1',
        start_timestamp: '2024-12-04T08:00:00Z',
        end_timestamp: undefined, // Still running
        duration_minutes: undefined,
        timezone: 'UTC',
        apply_break_calculation: true, // Timer was started with a button that has auto_subtract_breaks
        notes: '',
        is_manual: false,
        created_at: '2024-12-04T08:00:00Z',
        updated_at: '2024-12-04T08:00:00Z',
      };

      vi.mocked(db.getAllTimeLogs).mockResolvedValue([runningTimer]);

      // Stop the timer after 10 hours
      await timeLogsStore.stopTimer('timer-1', undefined, '2024-12-04T18:00:00Z');

      // Verify saveTimeLog was called with the correct duration
      expect(db.saveTimeLog).toHaveBeenCalled();
      const savedTimeLog = lastSavedTimeLog!;
      
      // 10 hours = 600 minutes
      // With apply_break_calculation: true and >= 9 hours, subtract 45 min
      // Expected: 600 - 45 = 555 minutes
      expect(savedTimeLog.duration_minutes).toBe(555);
      expect(savedTimeLog.end_timestamp).toBe('2024-12-04T18:00:00Z');
      expect(savedTimeLog.apply_break_calculation).toBe(true);
    });
  });
});
