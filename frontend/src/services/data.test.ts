import { describe, it, expect } from 'vitest';
import type { TimeLog, Balance } from '../types';
import dayjs from '../../../lib/utils/dayjs.js';
import {
  calculateDueMinutes,
  calculateWorkedMinutesForDate,
  aggregateToMonthly,
  aggregateToYearly,
  type Target as BalanceTarget,
} from '../../../lib/utils/balance.js';
import { calculateBalanceData } from '../stores/balances.js';

import {
  createSeedTargets,
  getAllSeedTimelogs,
  DEMO_USER_ID,
  WORK_TARGET_ID,
  STUDY_TARGET_ID,
  EXERCISE_TARGET_ID,
  WORK_TIMER_ID,
  STUDY_TIMER_ID,
  EXERCISE_TIMER_OLD_ID,
  getHolidaysSet,
  getTimelogsForDate,
  getTimelogsForTimer,
} from './testHelper';

/**
 * Unit tests for balance calculations using seed data from backend/src/scripts/seed.ts
 * Tests the initializeBalances flow and validates expected behavior from docs/balances.md
 */

// ============================================================================
// TESTS
// ============================================================================

describe('Balance Calculation Tests with Seed Data', () => {
  const targets = createSeedTargets();
  const allTimelogs = getAllSeedTimelogs();
  
  describe('calculateDueMinutes - Work Target', () => {
    const workTarget = targets.find(t => t.id === WORK_TARGET_ID)!;
    
    it('should return 480 min (8h) for Monday to Friday in October 2025 (old spec, no holidays)', () => {
      for (let day = 1; day <= 31; day ++) {
        const date = `2025-10-${day.toString().padStart(2, '0')}`;
        const result = calculateDueMinutes(date, workTarget as BalanceTarget, new Set());
        if (dayjs(date).day() != 0 && dayjs(date).day() != 6) {
          expect(result).toBe(480);
        } else {
          expect(result).toBe(0);
        }
      }

      for (let day = 1; day <= 30; day ++) {
        const date = `2025-11-${day.toString().padStart(2, '0')}`;
        const result = calculateDueMinutes(date, workTarget as BalanceTarget, new Set());
        if (dayjs(date).day() != 0 && dayjs(date).day() != 6) {
          expect(result).toBe(480);
        } else {
          expect(result).toBe(0);
        }
      }
    });
    
    it('should return 420 min (7h) for Monday to Friday in December 2025 (middle spec)', () => {
      const holidays = getHolidaysSet('DE-BW', 2025, 12);
      for (let day = 1; day <= 31; day ++) {
        const date = `2025-12-${day.toString().padStart(2, '0')}`;
        const result = calculateDueMinutes(date, workTarget as BalanceTarget, holidays);
        if (dayjs(date).day() != 0 && dayjs(date).day() != 6 && !holidays.has(date)) {
          expect(result).toBe(420);
        } else {
          expect(result).toBe(0);
        }
      }
    });
    
    it('should return 480 min (8h) for Monday to Friday in January 2026 (current spec)', () => {
      const holidays = getHolidaysSet('DE-BY', 2026, 1);
      for (let day = 1; day <= 31; day ++) {
        const date = `2026-01-${day.toString().padStart(2, '0')}`;
        const result = calculateDueMinutes(date, workTarget as BalanceTarget, holidays);
        if (dayjs(date).day() != 0 && dayjs(date).day() != 6 && !holidays.has(date)) {
          expect(result).toBe(480);
        } else {
          expect(result).toBe(0);
        }
      }
    });
  });
  
  describe('calculateDueMinutes - Study Target', () => {
    const studyTarget = targets.find(t => t.id === STUDY_TARGET_ID)!;

    it('should return 120 min (2h) for Tuesday and Thursdays in November to January 2026', () => {

      for (let day = 1; day <= 30; day ++) {
        const date = `2025-11-${day.toString().padStart(2, '0')}`;
        const result = calculateDueMinutes(date, studyTarget as BalanceTarget, new Set());
        if (dayjs(date).day() == 2 || dayjs(date).day() == 4) {
          expect(result).toBe(120);
        } else {
          expect(result).toBe(0);
        }
      }
      for (let day = 1; day <= 31; day ++) {
        const date = `2025-12-${day.toString().padStart(2, '0')}`;
        const result = calculateDueMinutes(date, studyTarget as BalanceTarget, new Set());
        if (dayjs(date).day() == 2 || dayjs(date).day() == 4) {
          expect(result).toBe(120);
        } else {
          expect(result).toBe(0);
        }
      }
      for (let day = 1; day <= 31; day ++) {
        const date = `2026-01-${day.toString().padStart(2, '0')}`;
        const result = calculateDueMinutes(date, studyTarget as BalanceTarget, new Set());
        if (dayjs(date).day() == 2 || dayjs(date).day() == 4) {
          expect(result).toBe(120);
        } else {
          expect(result).toBe(0);
        }
      }
    });
    
    it('should return 0 for dates before November 2025 (before starting_from)', () => {
      const date = '2025-10-15'; // October
      const result = calculateDueMinutes(date, studyTarget as BalanceTarget, new Set());
      expect(result).toBe(0);
    });
  });
  
  describe('calculateDueMinutes - Exercise Target (Ended)', () => {
    const exerciseTarget = targets.find(t => t.id === EXERCISE_TARGET_ID)!;
    
    it('should return 60 min (1h) for Monday in September/October 2025', () => {

      for (let day = 1; day <= 30; day ++) {
        const date = `2025-09-${day.toString().padStart(2, '0')}`;
        const result = calculateDueMinutes(date, exerciseTarget as BalanceTarget, new Set());
        if ([1, 3, 5].includes(dayjs(date).day())) {
          expect(result).toBe(60);
        } else {
          expect(result).toBe(0);
        }
      }
      for (let day = 1; day <= 31; day ++) {
        const date = `2025-10-${day.toString().padStart(2, '0')}`;
        const result = calculateDueMinutes(date, exerciseTarget as BalanceTarget, new Set());
        if ([1, 3, 5].includes(dayjs(date).day())) {
          expect(result).toBe(60);
        } else {
          expect(result).toBe(0);
        }
      }
    });
    
    it('should return 0 for dates after October 31 2025 (after ending_at)', () => {
      const date = '2025-11-03'; // Monday in November
      const result = calculateDueMinutes(date, exerciseTarget as BalanceTarget, new Set());
      expect(result).toBe(0);
    });
  });
  
  describe('calculateWorkedMinutesForDate - Work Timelogs', () => {
    const workTimelogs = getTimelogsForTimer(allTimelogs, WORK_TIMER_ID);
    
    it('should calculate worked minutes for October 2025 (8h work session)', () => {
      for (let day = 1; day <= 31; day ++) {
        const date = `2025-10-${day.toString().padStart(2, '0')}`;
        const dayTimelogs = getTimelogsForDate(workTimelogs, date);
        const result = calculateWorkedMinutesForDate(date, dayTimelogs);
        if (![0, 6].includes(dayjs(date).day())) {
          expect(result.worked_minutes).toBe(450);
          expect(result.counters.sick_days).toBe(0);
        } else {
          expect(result.worked_minutes).toBe(0);
          expect(result.counters.sick_days).toBe(0);
        }
      }
    });

    it('should calculate worked minutes for November 2025 (8.5h work session)', () => {
      for (let day = 1; day <= 30; day ++) {
        const date = `2025-11-${day.toString().padStart(2, '0')}`;
        const dayTimelogs = getTimelogsForDate(workTimelogs, date);
        const result = calculateWorkedMinutesForDate(date, dayTimelogs);
        if (![0, 6].includes(dayjs(date).day()) && day < 24) {
          expect(result.worked_minutes).toBe(480);
          expect(result.counters.sick_days).toBe(0);
        } else {
          expect(result.worked_minutes).toBe(0);
          expect(result.counters.sick_days).toBe(0);
        }
      }
    });
  });
  
  describe('calculateWorkedMinutesForDate - Exercise Timelogs', () => {
    const exerciseTimelogs = getTimelogsForTimer(allTimelogs, EXERCISE_TIMER_OLD_ID);
    
    it('should calculate 60 min for Mon/Wed/Fri in September 2025', () => {
      for (let day = 1; day <= 30; day++) {
        const date = `2025-09-${day.toString().padStart(2, '0')}`;
        const dayTimelogs = getTimelogsForDate(exerciseTimelogs, date);
        const result = calculateWorkedMinutesForDate(date, dayTimelogs);
        if ([1, 3, 5].includes(dayjs(date).day())) {
          expect(result.worked_minutes).toBe(60);
        } else {
          expect(result.worked_minutes).toBe(0);
        }
      }
    });
    
    it('should calculate 60 min for Mon/Wed/Fri in October 2025', () => {
      for (let day = 1; day <= 31; day++) {
        const date = `2025-10-${day.toString().padStart(2, '0')}`;
        const dayTimelogs = getTimelogsForDate(exerciseTimelogs, date);
        const result = calculateWorkedMinutesForDate(date, dayTimelogs);
        if ([1, 3, 5].includes(dayjs(date).day())) {
          expect(result.worked_minutes).toBe(60);
        } else {
          expect(result.worked_minutes).toBe(0);
        }
      }
    });
  });

  describe('calculateWorkedMinutesForDate - Study Timelogs', () => {
    const studyTimelogs = getTimelogsForTimer(allTimelogs, STUDY_TIMER_ID);
    
    it('should calculate 120 min for Tue/Thu in November 2025', () => {
      for (let day = 1; day <= 30; day++) {
        const date = `2025-11-${day.toString().padStart(2, '0')}`;
        const dayTimelogs = getTimelogsForDate(studyTimelogs, date);
        const result = calculateWorkedMinutesForDate(date, dayTimelogs);
        if ([2, 4].includes(dayjs(date).day()) && day <= 23) {
          expect(result.worked_minutes).toBe(120);
        } else {
          expect(result.worked_minutes).toBe(0);
        }
      }
    });

    it('should calculate 0 min for Tue/Thu in December 2025 (no logs)', () => {
      for (let day = 1; day <= 31; day++) {
        const date = `2025-12-${day.toString().padStart(2, '0')}`;
        const dayTimelogs = getTimelogsForDate(studyTimelogs, date);
        const result = calculateWorkedMinutesForDate(date, dayTimelogs);
        expect(result.worked_minutes).toBe(0);
      }
    });

    it('should calculate 0 min for Tue/Thu in January 2026 (no logs)', () => {
      for (let day = 1; day <= 31; day++) {
        const date = `2026-01-${day.toString().padStart(2, '0')}`;
        const dayTimelogs = getTimelogsForDate(studyTimelogs, date);
        const result = calculateWorkedMinutesForDate(date, dayTimelogs);
        expect(result.worked_minutes).toBe(0);
      }
    });
  });
  
  describe('Daily Balance: calculateBalanceData - Work Target October/November 2025', () => {
    const workTarget = targets.find(t => t.id === WORK_TARGET_ID)!;
    const workTimelogs = getTimelogsForTimer(allTimelogs, WORK_TIMER_ID);
    
    it('should calculate daily balance for weekdays in October 2025', () => {
      for (let day = 1; day <= 31; day++) {
        const date = `2025-10-${day.toString().padStart(2, '0')}`;
        const dayTimelogs = getTimelogsForDate(workTimelogs, date);
        const balance = calculateBalanceData(
          date,
          workTarget as BalanceTarget,
          dayTimelogs,
          new Set()
        );
        
        if (![0, 6].includes(dayjs(date).day())) {
          expect(balance.due_minutes).toBe(480);
          expect(balance.worked_minutes).toBe(450);
          expect(balance.cumulative_minutes).toBe(0);
          expect(balance.worked_days).toBe(1);
          expect(balance.sick_days).toBe(0);
        } else {
          expect(balance.due_minutes).toBe(0);
          expect(balance.worked_minutes).toBe(0);
          expect(balance.cumulative_minutes).toBe(0);
          expect(balance.worked_days).toBe(0);
        }
      }
    });
    
    it('should calculate daily balance for weekdays in November 1-23 2025', () => {
      for (let day = 1; day <= 30; day++) {
        const date = `2025-11-${day.toString().padStart(2, '0')}`;
        const dayTimelogs = getTimelogsForDate(workTimelogs, date);
        const balance = calculateBalanceData(
          date,
          workTarget as BalanceTarget,
          dayTimelogs,
          new Set()
        );
        
        if (![0, 6].includes(dayjs(date).day()) && day <= 23) {
          expect(balance.due_minutes).toBe(480);
          expect(balance.worked_minutes).toBe(480);
          expect(balance.cumulative_minutes).toBe(0);
          expect(balance.worked_days).toBe(1);
        } else if (![0, 6].includes(dayjs(date).day()) && day > 23) {
          expect(balance.due_minutes).toBe(480);
          expect(balance.worked_minutes).toBe(0);
          expect(balance.cumulative_minutes).toBe(0);
          expect(balance.worked_days).toBe(0);
        } else {
          expect(balance.due_minutes).toBe(0);
          expect(balance.worked_minutes).toBe(0);
          expect(balance.cumulative_minutes).toBe(0);
          expect(balance.worked_days).toBe(0);
        }
      }
    });
  });
  
  describe('Daily Balance: calculateBalanceData - Study Target November 2025', () => {
    const studyTarget = targets.find(t => t.id === STUDY_TARGET_ID)!;
    const studyTimelogs = getTimelogsForTimer(allTimelogs, STUDY_TIMER_ID);
    
    it('should calculate balance for Tue/Thu in November 2025', () => {
      for (let day = 1; day <= 30; day++) {
        const date = `2025-11-${day.toString().padStart(2, '0')}`;
        const dayTimelogs = getTimelogsForDate(studyTimelogs, date);
        const balance = calculateBalanceData(
          date,
          studyTarget as BalanceTarget,
          dayTimelogs,
          new Set()
        );
        
        if ([2, 4].includes(dayjs(date).day()) && day <= 23) {
          expect(balance.due_minutes).toBe(120);
          expect(balance.worked_minutes).toBe(120);
          expect(balance.cumulative_minutes).toBe(0);
          expect(balance.worked_days).toBe(1);
        } else if ([2, 4].includes(dayjs(date).day()) && day > 23) {
          expect(balance.due_minutes).toBe(120);
          expect(balance.worked_minutes).toBe(0);
          expect(balance.cumulative_minutes).toBe(0);
          expect(balance.worked_days).toBe(0);
        } else {
          expect(balance.due_minutes).toBe(0);
          expect(balance.worked_minutes).toBe(0);
          expect(balance.cumulative_minutes).toBe(0);
          expect(balance.worked_days).toBe(0);
        }
      }
    });
  });
  
  describe('Daily Balance: calculateBalanceData - Exercise Target', () => {
    const exerciseTarget = targets.find(t => t.id === EXERCISE_TARGET_ID)!;
    const exerciseTimelogs = getTimelogsForTimer(allTimelogs, EXERCISE_TIMER_OLD_ID);

    it('should calculate balance for September 2025', () => {
      for (let day = 1; day <= 30; day++) {
        const date = dayjs.utc(`2025-09-${day.toString().padStart(2, '0')}`);
        const dayOfWeek = date.day();
        const dateStr = date.format('YYYY-MM-DD');
        const dayTimelogs = getTimelogsForDate(exerciseTimelogs, dateStr);
        const balance = calculateBalanceData(
          dateStr,
          exerciseTarget as BalanceTarget,
          dayTimelogs,
          new Set()
        );
        
        if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
          expect(balance.due_minutes).toBe(60);
          expect(balance.worked_minutes).toBe(60);
          expect(balance.cumulative_minutes).toBe(0);
          expect(balance.worked_days).toBe(1);
        } else {
          expect(balance.due_minutes).toBe(0);
          expect(balance.worked_minutes).toBe(0);
          expect(balance.cumulative_minutes).toBe(0);
          expect(balance.worked_days).toBe(0);
        }
      }
    });
    
    it('should calculate October 2025 exercise totals', () => {
      for (let day = 1; day <= 31; day++) {
        const date = dayjs.utc(`2025-10-${day.toString().padStart(2, '0')}`);
        const dayOfWeek = date.day();
        const dateStr = date.format('YYYY-MM-DD');
        const dayTimelogs = getTimelogsForDate(exerciseTimelogs, dateStr);
        const balance = calculateBalanceData(
          dateStr,
          exerciseTarget as BalanceTarget,
          dayTimelogs,
          new Set()
        );
        
        if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
          expect(balance.due_minutes).toBe(60);
          expect(balance.worked_minutes).toBe(60);
          expect(balance.cumulative_minutes).toBe(0);
          expect(balance.worked_days).toBe(1);
        } else {
          expect(balance.due_minutes).toBe(0);
          expect(balance.worked_minutes).toBe(0);
          expect(balance.cumulative_minutes).toBe(0);
          expect(balance.worked_days).toBe(0);
        }
      }
    });
  });
  
  describe('aggregateToMonthly', () => {
    it('should aggregate daily balances to monthly for October 2025 Work', () => {
      const workTarget = targets.find(t => t.id === WORK_TARGET_ID)!;
      const workTimelogs = getTimelogsForTimer(allTimelogs, WORK_TIMER_ID);
      
      const dailyBalances: Balance[] = [];
      
      for (let day = 1; day <= 31; day++) {
        const date = `2025-10-${day.toString().padStart(2, '0')}`;
        const dayTimelogs = getTimelogsForDate(workTimelogs, date);
        const balance = calculateBalanceData(
          date,
          workTarget as BalanceTarget,
          dayTimelogs,
          new Set()
        );
        dailyBalances.push(balance as Balance);
      }
      
      const monthlyBalance = aggregateToMonthly(dailyBalances, 0);
      
      expect(monthlyBalance.date).toBe('2025-10');
      expect(monthlyBalance.target_id).toBe(WORK_TARGET_ID);
      expect(monthlyBalance.due_minutes).toBe(23 * 480);
      expect(monthlyBalance.worked_minutes).toBe(23 * 450);
      expect(monthlyBalance.cumulative_minutes).toBe(0);
      expect(monthlyBalance.worked_days).toBe(23);
    });

    it('should aggregate with previous cumulation (Monthly Balance November 2025)', () => {
      const workTarget = targets.find(t => t.id === WORK_TARGET_ID)!;
      const workTimelogs = getTimelogsForTimer(allTimelogs, WORK_TIMER_ID);
      
      const dailyBalances: Balance[] = [];
      
      for (let day = 1; day <= 30; day++) {
        const date = `2025-11-${day.toString().padStart(2, '0')}`;
        const dayTimelogs = getTimelogsForDate(workTimelogs, date);
        const balance = calculateBalanceData(
          date,
          workTarget as BalanceTarget,
          dayTimelogs,
          new Set()
        );
        dailyBalances.push(balance as Balance);
      }
      
      const previousCumulation = 23 * (-30);
      
      const monthlyBalance = aggregateToMonthly(dailyBalances, previousCumulation);
      
      expect(monthlyBalance.cumulative_minutes).toBe(previousCumulation);
    });
  });
  
  describe('aggregateToYearly', () => {
    it('should aggregate monthly balances to yearly', () => {
      const monthlyBalances: Balance[] = [
        {
          id: `${WORK_TARGET_ID}_2025-10`,
          user_id: DEMO_USER_ID,
          target_id: WORK_TARGET_ID,
          date: '2025-10',
          due_minutes: 11040, // 23 * 480
          worked_minutes: 10350, // 23 * 450
          cumulative_minutes: 0,
          sick_days: 0,
          holidays: 0,
          business_trip: 0,
          child_sick: 0,
          worked_days: 23,
          created_at: '2025-10-31',
          updated_at: '2025-10-31',
        },
        {
          id: `${WORK_TARGET_ID}_2025-11`,
          user_id: DEMO_USER_ID,
          target_id: WORK_TARGET_ID,
          date: '2025-11',
          due_minutes: 8160, // 17 * 480
          worked_minutes: 8160, // 17 * 480
          cumulative_minutes: -690, // carried from October
          sick_days: 0,
          holidays: 0,
          business_trip: 0,
          child_sick: 0,
          worked_days: 17,
          created_at: '2025-11-23',
          updated_at: '2025-11-23',
        },
      ];
      
      const yearlyBalance = aggregateToYearly(monthlyBalances, 0);
      
      expect(yearlyBalance.date).toBe('2025');
      expect(yearlyBalance.target_id).toBe(WORK_TARGET_ID);
      expect(yearlyBalance.due_minutes).toBe(11040 + 8160);
      expect(yearlyBalance.worked_minutes).toBe(10350 + 8160);
      expect(yearlyBalance.worked_days).toBe(23 + 17);
      expect(yearlyBalance.cumulative_minutes).toBe(0); // cumulation from previous year is 0
    });
  });
  
  describe('Special Day Types', () => {
    it('should count sick days correctly', () => {
      const sickDayTimelog: TimeLog = {
        id: 'sick-1',
        user_id: DEMO_USER_ID,
        timer_id: WORK_TIMER_ID,
        type: 'sick',
        whole_day: true,
        start_timestamp: '2025-11-10T00:00:00.000Z',
        end_timestamp: '2025-11-10T23:59:59.999Z',
        timezone: 'Europe/Berlin',
        apply_break_calculation: false,
        created_at: '2025-11-10',
        updated_at: '2025-11-10',
        year: 2025,
        month: 11,
      };
      
      const result = calculateWorkedMinutesForDate('2025-11-10', [sickDayTimelog]);
      
      expect(result.worked_minutes).toBe(0);
      expect(result.counters.sick_days).toBe(1);
      expect(result.counters.holidays).toBe(0);
    });
    
    it('should count holidays (vacation) correctly', () => {
      const holidayTimelog: TimeLog = {
        id: 'holiday-1',
        user_id: DEMO_USER_ID,
        timer_id: WORK_TIMER_ID,
        type: 'holiday',
        whole_day: true,
        start_timestamp: '2025-11-11T00:00:00.000Z',
        end_timestamp: '2025-11-11T23:59:59.999Z',
        timezone: 'Europe/Berlin',
        apply_break_calculation: false,
        created_at: '2025-11-11',
        updated_at: '2025-11-11',
        year: 2025,
        month: 11,
      };
      
      const result = calculateWorkedMinutesForDate('2025-11-11', [holidayTimelog]);
      
      expect(result.worked_minutes).toBe(0);
      expect(result.counters.holidays).toBe(1);
      expect(result.counters.sick_days).toBe(0);
    });
    
    it('should count business trip correctly', () => {
      const businessTripTimelog: TimeLog = {
        id: 'business-trip-1',
        user_id: DEMO_USER_ID,
        timer_id: WORK_TIMER_ID,
        type: 'business-trip',
        whole_day: true,
        start_timestamp: '2025-11-12T08:00:00.000Z',
        end_timestamp: '2025-11-12T18:00:00.000Z',
        timezone: 'Europe/Berlin',
        apply_break_calculation: true,
        created_at: '2025-11-12',
        updated_at: '2025-11-12',
        year: 2025,
        month: 11,
      };
      
      const result = calculateWorkedMinutesForDate('2025-11-12', [businessTripTimelog]);
      
      expect(result.counters.business_trip).toBe(1);
    });
    
    it('should count child sick days correctly', () => {
      const childSickTimelog: TimeLog = {
        id: 'child-sick-1',
        user_id: DEMO_USER_ID,
        timer_id: WORK_TIMER_ID,
        type: 'child-sick',
        whole_day: true,
        start_timestamp: '2025-11-13T00:00:00.000Z',
        end_timestamp: '2025-11-13T12:00:00.000Z',
        timezone: 'Europe/Berlin',
        apply_break_calculation: false,
        created_at: '2025-11-13',
        updated_at: '2025-11-13',
        year: 2025,
        month: 11,
      };
      
      const result = calculateWorkedMinutesForDate('2025-11-13', [childSickTimelog]);
      
      expect(result.counters.child_sick).toBe(1);
    });
  });
  
  describe('Cumulative Balance Chain', () => {
    it('should correctly chain cumulative balances across months', () => {
      const octoberCumulative = (23 * 510) - (23 * 480);
      
      const novemberDifference = (15 * 540) - (15 * 480);
      const novemberCumulative = octoberCumulative + novemberDifference;
      
      expect(octoberCumulative).toBe(690);
      expect(novemberCumulative).toBe(1590);
    });
  });
  
  describe('Worked Days Calculation', () => {
    it('should count worked days correctly (excluding weekends)', () => {
      const workTarget = targets.find(t => t.id === WORK_TARGET_ID)!;
      const workTimelogs = getTimelogsForTimer(allTimelogs, WORK_TIMER_ID);
      
      let workedDays = 0;
      
      for (let day = 1; day <= 31; day++) {
        const dateStr = `2025-10-${day.toString().padStart(2, '0')}`;
        const { worked_minutes } = calculateWorkedMinutesForDate(
          dateStr,
          getTimelogsForDate(workTimelogs, dateStr)
        );
        
        if (worked_minutes > 0) {
          workedDays++;
        }
      }
      
      expect(workedDays).toBe(23);
    });
  });
  
  describe('Target Spec Date Range Validation', () => {
    const workTarget = targets.find(t => t.id === WORK_TARGET_ID)!;
    
    it('should use correct spec (8h) for weekdays in October 2025', () => {
      for (let day = 1; day <= 31; day++) {
        const date = `2025-10-${day.toString().padStart(2, '0')}`;
        const dueMinutes = calculateDueMinutes(date, workTarget as BalanceTarget, new Set());
        if (![0, 6].includes(dayjs(date).day())) {
          expect(dueMinutes).toBe(480);
        }
      }
    });
    
    it('should use correct spec (7h) for weekdays in December 2025', () => {
      for (let day = 1; day <= 31; day++) {
        const date = `2025-12-${day.toString().padStart(2, '0')}`;
        const dueMinutes = calculateDueMinutes(date, workTarget as BalanceTarget, new Set());
        if (![0, 6].includes(dayjs(date).day())) {
          expect(dueMinutes).toBe(420);
        }
      }
    });
    
    it('should use correct spec (8h) for weekdays in January 2026', () => {
      for (let day = 1; day <= 31; day++) {
        const date = `2026-01-${day.toString().padStart(2, '0')}`;
        const dueMinutes = calculateDueMinutes(date, workTarget as BalanceTarget, new Set());
        if (![0, 6].includes(dayjs(date).day())) {
          expect(dueMinutes).toBe(480);
        }
      }
    });
  });
  
  describe('Break Calculation', () => {
    it('should handle timelogs with break subtraction using current implementation', () => {
      const timelog: TimeLog = {
        id: 'break-test-1',
        user_id: DEMO_USER_ID,
        timer_id: WORK_TIMER_ID,
        type: 'normal',
        whole_day: false,
        start_timestamp: '2025-10-06T09:00:00.000Z',
        end_timestamp: '2025-10-06T17:00:00.000Z',
        duration_minutes: 450,
        timezone: 'Europe/Berlin',
        apply_break_calculation: true,
        created_at: '2025-10-06',
        updated_at: '2025-10-06',
        year: 2025,
        month: 10,
      };
      
      const result = calculateWorkedMinutesForDate('2025-10-06', [timelog]);
      expect(result.worked_minutes).toBe(450);
    });
    
    it('should not add break difference for timelogs < 6h (no break applied)', () => {
      const timelog: TimeLog = {
        id: 'no-break-test',
        user_id: DEMO_USER_ID,
        timer_id: STUDY_TIMER_ID,
        type: 'normal',
        whole_day: false,
        start_timestamp: '2025-11-04T19:00:00.000Z',
        end_timestamp: '2025-11-04T21:00:00.000Z',
        duration_minutes: 120,
        timezone: 'Europe/Berlin',
        apply_break_calculation: false,
        created_at: '2025-11-04',
        updated_at: '2025-11-04',
        year: 2025,
        month: 11,
      };
      
      const result = calculateWorkedMinutesForDate('2025-11-04', [timelog]);
      expect(result.worked_minutes).toBe(120);
    });
  });
  
  describe('Multi-day Timelogs', () => {
    it('should clip timelog to single day correctly', () => {
      const multiDayTimelog: TimeLog = {
        id: 'multiday-1',
        user_id: DEMO_USER_ID,
        timer_id: WORK_TIMER_ID,
        type: 'normal',
        whole_day: false,
        start_timestamp: '2025-10-06T20:00:00.000Z',
        end_timestamp: '2025-10-07T04:00:00.000Z',
        duration_minutes: 480,
        timezone: 'Europe/Berlin',
        apply_break_calculation: false,
        created_at: '2025-10-07',
        updated_at: '2025-10-07',
        year: 2025,
        month: 10,
      };
      
      const oct6Result = calculateWorkedMinutesForDate('2025-10-06', [multiDayTimelog]);
      expect(oct6Result.worked_minutes).toBeGreaterThanOrEqual(239);
      expect(oct6Result.worked_minutes).toBeLessThanOrEqual(240);
      
      const oct7Result = calculateWorkedMinutesForDate('2025-10-07', [multiDayTimelog]);
      expect(oct7Result.worked_minutes).toBe(240);
    });
  });
});
