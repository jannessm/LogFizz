/**
 * Tests for balance calculation utilities
 */

import { describe, it, expect } from 'vitest';
import dayjs from './dayjs.js';
import {
  getEffectiveRange,
  calculateTimelogDuration,
  calculateWorkedMinutesForDate,
  calculateDueMinutes,
  aggregateToMonthly,
  aggregateToYearly,
  type Balance,
  type Target,
} from './balance.js';
import type { TimeLog, TargetSpec } from '../types/index.js';

describe('Balance Calculation Utilities', () => {
  describe('getEffectiveRange', () => {
    it('should return null when timespans do not overlap', () => {
      const date = '2024-06-15';
      const start = '2024-06-14T10:00:00Z';
      const end = '2024-06-14T18:00:00Z';
      
      const result = getEffectiveRange(date, start, end);
      expect(result).toBeNull();
    });

    it('should clip start time to day start when log starts before day', () => {
      const date = '2024-06-15';
      const start = '2024-06-14T22:00:00Z';
      const end = '2024-06-15T10:00:00Z';
      
      const result = getEffectiveRange(date, start, end);
      expect(result).not.toBeNull();
      expect(result!.effectiveStart.format('YYYY-MM-DD HH:mm')).toBe('2024-06-15 00:00');
      expect(result!.effectiveEnd.format('YYYY-MM-DD HH:mm')).toBe('2024-06-15 10:00');
    });

    it('should clip end time to day end when log ends after day', () => {
      const date = '2024-06-15';
      const start = '2024-06-15T20:00:00Z';
      const end = '2024-06-16T02:00:00Z';
      
      const result = getEffectiveRange(date, start, end);
      expect(result).not.toBeNull();
      expect(result!.effectiveStart.format('YYYY-MM-DD HH:mm')).toBe('2024-06-15 20:00');
      expect(result!.effectiveEnd.format('YYYY-MM-DD HH:mm')).toBe('2024-06-15 23:59');
    });

    it('should handle logs fully contained within the day', () => {
      const date = '2024-06-15';
      const start = '2024-06-15T09:00:00Z';
      const end = '2024-06-15T17:00:00Z';
      
      const result = getEffectiveRange(date, start, end);
      expect(result).not.toBeNull();
      expect(result!.effectiveStart.format('YYYY-MM-DD HH:mm')).toBe('2024-06-15 09:00');
      expect(result!.effectiveEnd.format('YYYY-MM-DD HH:mm')).toBe('2024-06-15 17:00');
    });
  });

  describe('calculateTimelogDuration', () => {
    it('should return -1 for whole-day timelogs', () => {
      const timelog: Partial<TimeLog> = {
        whole_day: true,
        type: 'sick',
      } as TimeLog;
      
      expect(calculateTimelogDuration(timelog as TimeLog)).toBe(-1);
    });

    it('should use existing duration_minutes if available', () => {
      const timelog: Partial<TimeLog> = {
        whole_day: false,
        duration_minutes: 480,
      } as TimeLog;
      
      expect(calculateTimelogDuration(timelog as TimeLog)).toBe(480);
    });

    it('should calculate duration from timestamps', () => {
      const timelog: Partial<TimeLog> = {
        whole_day: false,
        start_timestamp: '2024-06-15T09:00:00Z',
        end_timestamp: '2024-06-15T17:00:00Z',
        apply_break_calculation: false,
      } as TimeLog;
      
      expect(calculateTimelogDuration(timelog as TimeLog)).toBe(480);
    });

    it('should apply 30min break for 6-9 hour sessions', () => {
      const timelog: Partial<TimeLog> = {
        whole_day: false,
        start_timestamp: '2024-06-15T09:00:00Z',
        end_timestamp: '2024-06-15T16:00:00Z', // 7 hours
        apply_break_calculation: true,
      } as TimeLog;
      
      expect(calculateTimelogDuration(timelog as TimeLog)).toBe(390); // 420 - 30
    });

    it('should apply 45min break for 9+ hour sessions', () => {
      const timelog: Partial<TimeLog> = {
        whole_day: false,
        start_timestamp: '2024-06-15T09:00:00Z',
        end_timestamp: '2024-06-15T18:00:00Z', // 9 hours
        apply_break_calculation: true,
      } as TimeLog;
      
      expect(calculateTimelogDuration(timelog as TimeLog)).toBe(495); // 540 - 45
    });
  });

  describe('calculateWorkedMinutesForDate', () => {
    it('should count worked minutes from normal timelogs', () => {
      const date = '2024-06-15';
      const timelogs: Partial<TimeLog>[] = [
        {
          type: 'normal',
          whole_day: false,
          start_timestamp: '2024-06-15T09:00:00Z',
          end_timestamp: '2024-06-15T17:00:00Z',
          apply_break_calculation: false,
        },
      ];
      
      const result = calculateWorkedMinutesForDate(date, timelogs as TimeLog[]);
      expect(result.worked_minutes).toBe(480);
      expect(result.counters.sick_days).toBe(0);
    });

    it('should increment sick_days counter for whole-day sick logs', () => {
      const date = '2024-06-15';
      const timelogs: Partial<TimeLog>[] = [
        {
          type: 'sick',
          whole_day: true,
        },
      ];
      
      const result = calculateWorkedMinutesForDate(date, timelogs as TimeLog[]);
      expect(result.worked_minutes).toBe(0);
      expect(result.counters.sick_days).toBe(1);
    });

    it('should handle multi-day timelogs correctly', () => {
      const date = '2024-06-15';
      const timelogs: Partial<TimeLog>[] = [
        {
          type: 'normal',
          whole_day: false,
          start_timestamp: '2024-06-14T22:00:00Z',
          end_timestamp: '2024-06-15T10:00:00Z',
          apply_break_calculation: false,
        },
      ];
      
      const result = calculateWorkedMinutesForDate(date, timelogs as TimeLog[]);
      // Should only count from midnight to 10am = 600 minutes
      expect(result.worked_minutes).toBe(600);
    });
  });

  describe('calculateDueMinutes', () => {
    const createTarget = (specs: Partial<TargetSpec>[]): Target => ({
      id: 'target-1',
      user_id: 'user-1',
      name: 'Test Target',
      target_specs: specs.map(spec => ({
        id: `spec-${Math.random()}`,
        user_id: 'user-1',
        target_id: 'target-1',
        starting_from: spec.starting_from || '2024-01-01',
        ending_at: spec.ending_at || undefined,
        duration_minutes: spec.duration_minutes || [480, 480, 480, 480, 480],
        weekdays: spec.weekdays || [1, 2, 3, 4, 5],
        exclude_holidays: spec.exclude_holidays !== undefined ? spec.exclude_holidays : false,
        state_code: spec.state_code || undefined,
      })),
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });

    it('should return due minutes for workdays', () => {
      const target = createTarget([{
        starting_from: '2024-01-01',
        weekdays: [1, 2, 3, 4, 5], // Mon-Fri
        duration_minutes: [480, 480, 480, 480, 480],
      }]);
      
      // Monday, June 17, 2024
      const date = '2024-06-17';
      const result = calculateDueMinutes(date, target);
      expect(result).toBe(480);
    });

    it('should return 0 for weekends', () => {
      const target = createTarget([{
        starting_from: '2024-01-01',
        weekdays: [1, 2, 3, 4, 5], // Mon-Fri only
        duration_minutes: [480, 480, 480, 480, 480],
      }]);
      
      // Saturday, June 15, 2024
      const date = '2024-06-15';
      const result = calculateDueMinutes(date, target);
      expect(result).toBe(0);
    });

    it('should return 0 for holidays when exclude_holidays is true', () => {
      const target = createTarget([{
        starting_from: '2024-01-01',
        weekdays: [1, 2, 3, 4, 5],
        duration_minutes: [480, 480, 480, 480, 480],
        exclude_holidays: true,
      }]);
      
      const holidays = new Set(['2024-06-17']);
      const date = '2024-06-17'; // Monday but also a holiday
      const result = calculateDueMinutes(date, target, holidays);
      expect(result).toBe(0);
    });

    it('should handle multiple duration specs and use the applicable one', () => {
      const target = createTarget([
        {
          starting_from: '2024-01-01',
          ending_at: '2024-06-30',
          weekdays: [1, 2, 3, 4, 5],
          duration_minutes: [480, 480, 480, 480, 480],
        },
        {
          starting_from: '2024-07-01',
          weekdays: [1, 2, 3, 4, 5],
          duration_minutes: [360, 360, 360, 360, 360],
        },
      ]);
      
      // Before July
      expect(calculateDueMinutes('2024-06-17', target)).toBe(480);
      
      // After July
      expect(calculateDueMinutes('2024-07-15', target)).toBe(360);
    });
  });

  describe('aggregateToMonthly', () => {
    it('should aggregate daily balances correctly', () => {
      const dailyBalances: Balance[] = [
        {
          id: 'daily-1',
          user_id: 'user-1',
          target_id: 'target-1',
          next_balance_id: null,
          
          date: '2024-06-01',
          due_minutes: 480,
          worked_minutes: 500,
          cumulative_minutes: 0, // Not used for daily
          sick_days: 0,
          holidays: 0,
          business_trip: 0,
          child_sick: 0,
          worked_days: 1,
          created_at: '2024-06-01T00:00:00Z',
          updated_at: '2024-06-01T00:00:00Z',
        },
        {
          id: 'daily-2',
          user_id: 'user-1',
          target_id: 'target-1',
          next_balance_id: null,
          
          date: '2024-06-02',
          due_minutes: 480,
          worked_minutes: 470,
          cumulative_minutes: 0,
          sick_days: 0,
          holidays: 0,
          business_trip: 0,
          child_sick: 0,
          worked_days: 1,
          created_at: '2024-06-02T00:00:00Z',
          updated_at: '2024-06-02T00:00:00Z',
        },
      ];
      
      const result = aggregateToMonthly(dailyBalances, 0);
      expect(result.date).toBe('2024-06');
      expect(result.due_minutes).toBe(960);
      expect(result.worked_minutes).toBe(970);
      expect(result.cumulative_minutes).toBe(10); // 970 - 960 + 0
      expect(result.worked_days).toBe(2);
    });

    it('should add due minutes for sick days to worked minutes', () => {
      const dailyBalances: Balance[] = [
        {
          id: 'daily-1',
          user_id: 'user-1',
          target_id: 'target-1',
          next_balance_id: null,
          
          date: '2024-06-01',
          due_minutes: 480,
          worked_minutes: 0,
          cumulative_minutes: 0,
          sick_days: 1,
          holidays: 0,
          business_trip: 0,
          child_sick: 0,
          worked_days: 0,
          created_at: '2024-06-01T00:00:00Z',
          updated_at: '2024-06-01T00:00:00Z',
        },
      ];
      
      const result = aggregateToMonthly(dailyBalances, 0);
      expect(result.worked_minutes).toBe(480); // 0 + 480 (from sick day)
      expect(result.sick_days).toBe(1);
    });

    it('should carry forward previous cumulation', () => {
      const dailyBalances: Balance[] = [
        {
          id: 'daily-1',
          user_id: 'user-1',
          target_id: 'target-1',
          next_balance_id: null,
          
          date: '2024-06-01',
          due_minutes: 480,
          worked_minutes: 480,
          cumulative_minutes: 0,
          sick_days: 0,
          holidays: 0,
          business_trip: 0,
          child_sick: 0,
          worked_days: 1,
          created_at: '2024-06-01T00:00:00Z',
          updated_at: '2024-06-01T00:00:00Z',
        },
      ];
      
      const previousCumulation = 120;
      const result = aggregateToMonthly(dailyBalances, previousCumulation);
      expect(result.cumulative_minutes).toBe(120); // 480 - 480 + 120
    });
  });

  describe('aggregateToYearly', () => {
    it('should aggregate monthly balances correctly', () => {
      const monthlyBalances: Balance[] = [
        {
          id: 'monthly-1',
          user_id: 'user-1',
          target_id: 'target-1',
          next_balance_id: null,
          
          date: '2024-01',
          due_minutes: 9600,
          worked_minutes: 9800,
          cumulative_minutes: 200,
          sick_days: 1,
          holidays: 0,
          business_trip: 0,
          child_sick: 0,
          worked_days: 20,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-31T00:00:00Z',
        },
        {
          id: 'monthly-2',
          user_id: 'user-1',
          target_id: 'target-1',
          next_balance_id: null,
          
          date: '2024-02',
          due_minutes: 9120,
          worked_minutes: 9100,
          cumulative_minutes: 180,
          sick_days: 0,
          holidays: 2,
          business_trip: 0,
          child_sick: 0,
          worked_days: 19,
          created_at: '2024-02-01T00:00:00Z',
          updated_at: '2024-02-29T00:00:00Z',
        },
      ];
      
      const result = aggregateToYearly(monthlyBalances, 0);
      expect(result.date).toBe('2024');
      expect(result.due_minutes).toBe(18720);
      expect(result.worked_minutes).toBe(18900);
      expect(result.cumulative_minutes).toBe(180); // 18900 - 18720 + 0
      expect(result.worked_days).toBe(39);
      expect(result.sick_days).toBe(1);
      expect(result.holidays).toBe(2);
    });
  });
});
