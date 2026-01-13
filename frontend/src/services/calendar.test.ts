import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get, writable } from 'svelte/store';
import { getTypeColor, hasSpecialType } from './calendar';
import type { TimeLog, Timer, Holiday, TargetWithSpecs } from '../types';
import dayjs from '../../../lib/utils/dayjs.js';

// Mock the store modules
vi.mock('../stores/timelogs', () => ({
  timeLogsStore: writable({ items: new Map() }),
}));

vi.mock('../stores/holidays', () => ({
  holidaysStore: writable({ holidays: [] }),
}));

// Import createCalendarStore after mocks are set up
import { createCalendarStore } from './calendar';
import { timeLogsStore } from '../stores/timelogs';
import { holidaysStore } from '../stores/holidays';

describe('Calendar Service', () => {
  beforeEach(() => {
    // Reset store state before each test
    timeLogsStore.set({ items: new Map() });
    holidaysStore.set({ holidays: [] });
  });

  describe('getTypeColor', () => {
    it('should return correct colors for special types', () => {
      expect(getTypeColor('sick')).toBe('#EF4444');
      expect(getTypeColor('holiday')).toBe('#10B981');
      expect(getTypeColor('business-trip')).toBe('#F59E0B');
      expect(getTypeColor('child-sick')).toBe('#EC4899');
      expect(getTypeColor('normal')).toBeNull();
    });

    it('should return null for unknown types', () => {
      expect(getTypeColor('unknown')).toBeNull();
      expect(getTypeColor('')).toBeNull();
    });
  });

  describe('hasSpecialType', () => {
    const timeLogs: TimeLog[] = [];

    it('should return false when date has no special type timelogs', () => {
      const date = dayjs('2026-01-15');
      const timeLogsByDate = new Map();
      const multiDay = { isInRange: false, isStart: false, isEnd: false, isMiddle: false, colors: [] };

      const result = hasSpecialType(date, timeLogsByDate, timeLogs, multiDay);
      expect(result.hasSpecial).toBe(false);
      expect(result.color).toBeNull();
    });

    it('should return false when in multi-day range', () => {
      const date = dayjs('2026-01-15');
      const timeLogsByDate = new Map();
      const multiDay = { isInRange: true, isStart: true, isEnd: false, isMiddle: false, colors: ['#EF4444'] };

      const result = hasSpecialType(date, timeLogsByDate, timeLogs, multiDay);
      expect(result.hasSpecial).toBe(false);
      expect(result.color).toBeNull();
    });

    it('should detect single-day sick leave', () => {
      const date = dayjs('2026-01-15');
      const sickLog: TimeLog = {
        id: 'sick-1',
        user_id: 'user-1',
        timer_id: 'timer-1',
        type: 'sick',
        start_timestamp: '2026-01-15T08:00:00Z',
        end_timestamp: '2026-01-15T17:00:00Z',
        whole_day: true,
        year: 2026,
        month: 1,
        created_at: '2026-01-15T08:00:00Z',
        updated_at: '2026-01-15T08:00:00Z',
      };
      const timeLogsByDate = new Map([['2026-01-15', [sickLog]]]);
      const multiDay = { isInRange: false, isStart: false, isEnd: false, isMiddle: false, colors: [] };

      const result = hasSpecialType(date, timeLogsByDate, [sickLog], multiDay);
      expect(result.hasSpecial).toBe(true);
      expect(result.color).toBe('#EF4444');
    });

    it('should detect single-day holiday', () => {
      const date = dayjs('2026-01-15');
      const holidayLog: TimeLog = {
        id: 'holiday-1',
        user_id: 'user-1',
        timer_id: 'timer-1',
        type: 'holiday',
        start_timestamp: '2026-01-15T08:00:00Z',
        end_timestamp: '2026-01-15T17:00:00Z',
        whole_day: true,
        year: 2026,
        month: 1,
        created_at: '2026-01-15T08:00:00Z',
        updated_at: '2026-01-15T08:00:00Z',
      };
      const timeLogsByDate = new Map([['2026-01-15', [holidayLog]]]);
      const multiDay = { isInRange: false, isStart: false, isEnd: false, isMiddle: false, colors: [] };

      const result = hasSpecialType(date, timeLogsByDate, [holidayLog], multiDay);
      expect(result.hasSpecial).toBe(true);
      expect(result.color).toBe('#10B981');
    });

    it('should ignore multi-day special type logs', () => {
      const date = dayjs('2026-01-15');
      const multiDayHoliday: TimeLog = {
        id: 'holiday-1',
        user_id: 'user-1',
        timer_id: 'timer-1',
        type: 'holiday',
        start_timestamp: '2026-01-14T08:00:00Z',
        end_timestamp: '2026-01-17T17:00:00Z',
        whole_day: true,
        timezone: 'Europe/Berlin',
        year: 2026,
        month: 1,
        created_at: '2026-01-14T08:00:00Z',
        updated_at: '2026-01-14T08:00:00Z',
      };
      const timeLogsByDate = new Map([['2026-01-15', [multiDayHoliday]]]);
      const multiDay = { isInRange: false, isStart: false, isEnd: false, isMiddle: false, colors: [] };

      const result = hasSpecialType(date, timeLogsByDate, [multiDayHoliday], multiDay);
      expect(result.hasSpecial).toBe(false);
      expect(result.color).toBeNull();
    });

    it('should ignore normal type timelogs', () => {
      const date = dayjs('2026-01-15');
      const normalLog: TimeLog = {
        id: 'normal-1',
        user_id: 'user-1',
        timer_id: 'timer-1',
        type: 'normal',
        start_timestamp: '2026-01-15T08:00:00Z',
        end_timestamp: '2026-01-15T17:00:00Z',
        year: 2026,
        month: 1,
        created_at: '2026-01-15T08:00:00Z',
        updated_at: '2026-01-15T08:00:00Z',
      };
      const timeLogsByDate = new Map([['2026-01-15', [normalLog]]]);
      const multiDay = { isInRange: false, isStart: false, isEnd: false, isMiddle: false, colors: [] };

      const result = hasSpecialType(date, timeLogsByDate, [normalLog], multiDay);
      expect(result.hasSpecial).toBe(false);
      expect(result.color).toBeNull();
    });
  });

  describe('createCalendarStore', () => {
    const timers: Timer[] = [
      {
        id: 'timer-1',
        user_id: 'user-1',
        name: 'Work',
        color: '#3B82F6',
        auto_subtract_breaks: true,
        archived: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'timer-2',
        user_id: 'user-1',
        name: 'Study',
        color: '#10B981',
        auto_subtract_breaks: false,
        archived: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    const targets: TargetWithSpecs[] = [
      {
        id: 'target-1',
        user_id: 'user-1',
        name: 'Work',
        target_specs: [
          {
            id: 'spec-1',
            user_id: 'user-1',
            target_id: 'target-1',
            starting_from: '2026-01-01T00:00:00Z',
            duration_minutes: [0, 480, 480, 480, 480, 480, 0],
            exclude_holidays: true,
            state_code: 'DE-BY',
          },
        ],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    it('should create a store with empty data when no timelogs', () => {
      const store = createCalendarStore(2026, 1, 1, timers, targets);
      const value = get(store);

      expect(value.timeLogsByDate.size).toBe(0);
      expect(value.dotColors.size).toBe(0);
      expect(value.multiDayRanges.size).toBe(0);
    });

    it('should filter timelogs by month range', () => {
      const logs: TimeLog[] = [
        {
          id: 'log-1',
          user_id: 'user-1',
          timer_id: 'timer-1',
          start_timestamp: '2026-01-15T08:00:00Z',
          end_timestamp: '2026-01-15T17:00:00Z',
          year: 2026,
          month: 1,
          created_at: '2026-01-15T08:00:00Z',
          updated_at: '2026-01-15T08:00:00Z',
        },
        {
          id: 'log-2',
          user_id: 'user-1',
          timer_id: 'timer-2',
          start_timestamp: '2026-02-10T08:00:00Z',
          end_timestamp: '2026-02-10T17:00:00Z',
          year: 2026,
          month: 2,
          created_at: '2026-02-10T08:00:00Z',
          updated_at: '2026-02-10T08:00:00Z',
        },
        {
          id: 'log-3',
          user_id: 'user-1',
          timer_id: 'timer-1',
          start_timestamp: '2025-12-20T08:00:00Z',
          end_timestamp: '2025-12-20T17:00:00Z',
          year: 2025,
          month: 12,
          created_at: '2025-12-20T08:00:00Z',
          updated_at: '2025-12-20T08:00:00Z',
        },
        {
          id: 'log-4',
          user_id: 'user-1',
          timer_id: 'timer-1',
          start_timestamp: '2026-05-10T08:00:00Z',
          end_timestamp: '2026-05-10T17:00:00Z',
          year: 2026,
          month: 5,
          created_at: '2026-05-10T08:00:00Z',
          updated_at: '2026-05-10T08:00:00Z',
        },
      ];

      const itemsMap = new Map<string, TimeLog>();
      logs.forEach((log) => {
        itemsMap.set(log.id, log);
      });
      timeLogsStore.set({ items: itemsMap });

      const store = createCalendarStore(2026, 1, 1, timers, targets);
      const value = get(store);

      // Should include January ± 1 month (Dec 2025, Jan 2026, Feb 2026)
      expect(value.timeLogsByDate.has('2026-01-15')).toBe(true);
      expect(value.timeLogsByDate.has('2026-02-10')).toBe(true);
      expect(value.timeLogsByDate.has('2025-12-20')).toBe(true);
      expect(value.timeLogsByDate.has('2026-05-10')).toBe(false);
    });

    it('should exclude deleted timelogs', () => {
      const deletedLog: TimeLog = {
        id: 'log-deleted',
        user_id: 'user-1',
        timer_id: 'timer-1',
        start_timestamp: '2026-01-15T08:00:00Z',
        end_timestamp: '2026-01-15T17:00:00Z',
        year: 2026,
        month: 1,
        deleted_at: '2026-01-16T00:00:00Z',
        created_at: '2026-01-15T08:00:00Z',
        updated_at: '2026-01-16T00:00:00Z',
      };

      const itemsMap = new Map<string, TimeLog>();
      itemsMap.set(deletedLog.id, deletedLog);
      timeLogsStore.set({ items: itemsMap });

      const store = createCalendarStore(2026, 1, 1, timers, targets);
      const value = get(store);

      expect(value.timeLogsByDate.has('2026-01-15')).toBe(false);
    });

    it('should map timelogs to all dates they span (multi-day)', () => {
      const multiDayLog: TimeLog = {
        id: 'log-multi',
        user_id: 'user-1',
        timer_id: 'timer-1',
        start_timestamp: '2026-01-15T08:00:00Z',
        end_timestamp: '2026-01-18T17:00:00Z',
        year: 2026,
        month: 1,
        created_at: '2026-01-15T08:00:00Z',
        updated_at: '2026-01-15T08:00:00Z',
      };

      const itemsMap = new Map<string, TimeLog>();
      itemsMap.set(multiDayLog.id, multiDayLog);
      timeLogsStore.set({ items: itemsMap });

      const store = createCalendarStore(2026, 1, 1, timers, targets);
      const value = get(store);

      expect(value.timeLogsByDate.has('2026-01-15')).toBe(true);
      expect(value.timeLogsByDate.has('2026-01-16')).toBe(true);
      expect(value.timeLogsByDate.has('2026-01-17')).toBe(true);
      expect(value.timeLogsByDate.has('2026-01-18')).toBe(true);
      expect(value.timeLogsByDate.get('2026-01-15')?.[0].id).toBe('log-multi');
    });

    it('should build dotColors map with max 3 colors per day', () => {
      const logs: TimeLog[] = [
        {
          id: 'log-1',
          user_id: 'user-1',
          timer_id: 'timer-1',
          start_timestamp: '2026-01-15T08:00:00Z',
          end_timestamp: '2026-01-15T09:00:00Z',
          year: 2026,
          month: 1,
          created_at: '2026-01-15T08:00:00Z',
          updated_at: '2026-01-15T08:00:00Z',
        },
        {
          id: 'log-2',
          user_id: 'user-1',
          timer_id: 'timer-2',
          start_timestamp: '2026-01-15T10:00:00Z',
          end_timestamp: '2026-01-15T11:00:00Z',
          year: 2026,
          month: 1,
          created_at: '2026-01-15T10:00:00Z',
          updated_at: '2026-01-15T10:00:00Z',
        },
      ];

      const itemsMap = new Map<string, TimeLog>();
      logs.forEach((log) => {
        itemsMap.set(log.id, log);
      });
      timeLogsStore.set({ items: itemsMap });

      const store = createCalendarStore(2026, 1, 1, timers, targets);
      const value = get(store);

      const colors = value.dotColors.get('2026-01-15');
      expect(colors).toBeDefined();
      expect(colors?.length).toBe(2);
      expect(colors).toContain('#3B82F6');
      expect(colors).toContain('#10B981');
    });

    it('should not include whole_day timelogs in dotColors', () => {
      const wholeDayLog: TimeLog = {
        id: 'log-whole',
        user_id: 'user-1',
        timer_id: 'timer-1',
        type: 'holiday',
        start_timestamp: '2026-01-15T00:00:00Z',
        end_timestamp: '2026-01-15T23:59:59Z',
        whole_day: true,
        year: 2026,
        month: 1,
        created_at: '2026-01-15T08:00:00Z',
        updated_at: '2026-01-15T08:00:00Z',
      };

      const itemsMap = new Map<string, TimeLog>();
      itemsMap.set(wholeDayLog.id, wholeDayLog);
      timeLogsStore.set({ items: itemsMap });

      const store = createCalendarStore(2026, 1, 1, timers, targets);
      const value = get(store);

      const colors = value.dotColors.get('2026-01-15');
      expect(colors).toBeDefined();
      expect(colors?.length).toBe(0);
    });

    it('should calculate multi-day ranges for special types', () => {
      const multiDaySick: TimeLog = {
        id: 'sick-multi',
        user_id: 'user-1',
        timer_id: 'timer-1',
        type: 'sick',
        start_timestamp: '2026-01-15T00:00:00Z',
        end_timestamp: '2026-01-17T23:59:59Z',
        whole_day: true,
        year: 2026,
        month: 1,
        created_at: '2026-01-15T08:00:00Z',
        updated_at: '2026-01-15T08:00:00Z',
      };

      const itemsMap = new Map<string, TimeLog>();
      itemsMap.set(multiDaySick.id, multiDaySick);
      timeLogsStore.set({ items: itemsMap });

      const store = createCalendarStore(2026, 1, 1, timers, targets);
      const value = get(store);

      const range15 = value.multiDayRanges.get('2026-01-15');
      const range16 = value.multiDayRanges.get('2026-01-16');
      const range17 = value.multiDayRanges.get('2026-01-17');

      expect(range15?.isInRange).toBe(true);
      expect(range15?.isStart).toBe(true);
      expect(range15?.isEnd).toBe(false);
      expect(range15?.colors).toContain('#EF4444');

      expect(range16?.isInRange).toBe(true);
      expect(range16?.isMiddle).toBe(true);
      expect(range16?.colors).toContain('#EF4444');

      expect(range17?.isInRange).toBe(true);
      expect(range17?.isEnd).toBe(true);
      expect(range17?.isStart).toBe(false);
      expect(range17?.colors).toContain('#EF4444');
    });

    it('should handle overlapping multi-day ranges', () => {
      const logs: TimeLog[] = [
        {
          id: 'sick-1',
          user_id: 'user-1',
          timer_id: 'timer-1',
          type: 'sick',
          start_timestamp: '2026-01-15T00:00:00Z',
          end_timestamp: '2026-01-17T23:59:59Z',
          whole_day: true,
          year: 2026,
          month: 1,
          created_at: '2026-01-15T08:00:00Z',
          updated_at: '2026-01-15T08:00:00Z',
        },
        {
          id: 'holiday-1',
          user_id: 'user-1',
          timer_id: 'timer-1',
          type: 'holiday',
          start_timestamp: '2026-01-17T00:00:00Z',
          end_timestamp: '2026-01-19T23:59:59Z',
          whole_day: true,
          year: 2026,
          month: 1,
          created_at: '2026-01-17T08:00:00Z',
          updated_at: '2026-01-17T08:00:00Z',
        },
      ];

      const itemsMap = new Map<string, TimeLog>();
      logs.forEach((log) => {
        itemsMap.set(log.id, log);
      });
      timeLogsStore.set({ items: itemsMap });

      const store = createCalendarStore(2026, 1, 1, timers, targets);
      const value = get(store);

      const range17 = value.multiDayRanges.get('2026-01-17');
      expect(range17?.isInRange).toBe(true);
      expect(range17?.isMiddle).toBe(true); // Overlapping makes it middle
      expect(range17?.colors).toContain('#EF4444');
      expect(range17?.colors).toContain('#10B981');
    });

    it('should filter relevant holidays based on target specs', () => {
      const holidays: Holiday[] = [
        {
          id: 'h1',
          country: 'DE',
          global: false,
          counties: ['DE-BY'],
          date: '2026-01-01',
          name: 'Neujahr',
          year: 2026,
        },
        {
          id: 'h2',
          country: 'DE',
          global: false,
          counties: ['DE-BY'],
          date: '2026-01-06',
          name: 'Heilige Drei Könige',
          year: 2026,
        },
        {
          id: 'h3',
          country: 'US',
          global: false,
          counties: [],
          date: '2026-01-01',
          name: 'New Year',
          year: 2026,
        },
      ];

      holidaysStore.set({ holidays });

      const store = createCalendarStore(2026, 1, 1, timers, targets);
      const value = get(store);

      // Should include DE-BY holidays but not US holidays
      const jan1Holidays = value.relevantHolidays.get('2026-01-01');
      expect(jan1Holidays).toBeDefined();
      expect(jan1Holidays?.length).toBe(1);
      expect(jan1Holidays?.[0].country).toBe('DE');

      const jan6Holidays = value.relevantHolidays.get('2026-01-06');
      expect(jan6Holidays).toBeDefined();
      expect(jan6Holidays?.length).toBe(1);
    });

    it('should not include holidays when exclude_holidays is false', () => {
      const targetsNoExclude: TargetWithSpecs[] = [
        {
          id: 'target-1',
          user_id: 'user-1',
          name: 'Work',
          target_specs: [
            {
              id: 'spec-1',
              user_id: 'user-1',
              target_id: 'target-1',
              starting_from: '2026-01-01T00:00:00Z',
              duration_minutes: [0, 480, 480, 480, 480, 480, 0],
              exclude_holidays: false, // No holiday exclusion
            },
          ],
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      const holidays: Holiday[] = [
        {
          id: 'h1',
          country: 'DE',
          global: false,
          counties: ['DE-BY'],
          date: '2026-01-01',
          name: 'Neujahr',
          year: 2026,
        },
      ];

      holidaysStore.set({ holidays });

      const store = createCalendarStore(2026, 1, 1, timers, targetsNoExclude);
      const value = get(store);

      expect(value.relevantHolidays.size).toBe(0);
    });

    it('should handle global holidays', () => {
      const targetsWithGlobal: TargetWithSpecs[] = [
        {
          id: 'target-1',
          user_id: 'user-1',
          name: 'Work',
          target_specs: [
            {
              id: 'spec-1',
              user_id: 'user-1',
              target_id: 'target-1',
              starting_from: '2026-01-01T00:00:00Z',
              duration_minutes: [0, 480, 480, 480, 480, 480, 0],
              exclude_holidays: true,
              state_code: 'DE-BY',
            },
          ],
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      const holidays: Holiday[] = [
        {
          id: 'h1',
          country: 'DE',
          global: true, // Global holiday
          counties: [],
          date: '2026-01-01',
          name: 'Neujahr',
          year: 2026,
        },
      ];

      holidaysStore.set({ holidays });

      const store = createCalendarStore(2026, 1, 1, timers, targetsWithGlobal);
      const value = get(store);

      const jan1Holidays = value.relevantHolidays.get('2026-01-01');
      expect(jan1Holidays).toBeDefined();
      expect(jan1Holidays?.length).toBe(1);
      expect(jan1Holidays?.[0].global).toBe(true);
    });

    it('should respect target spec date ranges for holidays', () => {
      const targetsWithDateRange: TargetWithSpecs[] = [
        {
          id: 'target-1',
          user_id: 'user-1',
          name: 'Work',
          target_specs: [
            {
              id: 'spec-1',
              user_id: 'user-1',
              target_id: 'target-1',
              starting_from: '2026-01-10T00:00:00Z',
              ending_at: '2026-01-20T00:00:00Z',
              duration_minutes: [0, 480, 480, 480, 480, 480, 0],
              exclude_holidays: true,
              state_code: 'DE-BY',
            },
          ],
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      const holidays: Holiday[] = [
        {
          id: 'h1',
          country: 'DE',
          global: false,
          counties: ['DE-BY'],
          date: '2026-01-06', // Before spec range
          name: 'Heilige Drei Könige',
          year: 2026,
        },
        {
          id: 'h2',
          country: 'DE',
          global: false,
          counties: ['DE-BY'],
          date: '2026-01-15', // Within spec range
          name: 'Test Holiday',
          year: 2026,
        },
      ];

      holidaysStore.set({ holidays });

      const store = createCalendarStore(2026, 1, 1, timers, targetsWithDateRange);
      const value = get(store);

      expect(value.relevantHolidays.has('2026-01-06')).toBe(false);
      expect(value.relevantHolidays.has('2026-01-15')).toBe(true);
    });

    it('should use custom range parameter', () => {
      const logs: TimeLog[] = [
        {
          id: 'log-1',
          user_id: 'user-1',
          timer_id: 'timer-1',
          start_timestamp: '2025-11-15T08:00:00Z',
          end_timestamp: '2025-11-15T17:00:00Z',
          year: 2025,
          month: 11,
          created_at: '2025-11-15T08:00:00Z',
          updated_at: '2025-11-15T08:00:00Z',
        },
        {
          id: 'log-2',
          user_id: 'user-1',
          timer_id: 'timer-1',
          start_timestamp: '2026-03-15T08:00:00Z',
          end_timestamp: '2026-03-15T17:00:00Z',
          year: 2026,
          month: 3,
          created_at: '2026-03-15T08:00:00Z',
          updated_at: '2026-03-15T08:00:00Z',
        },
      ];

      const itemsMap = new Map<string, TimeLog>();
      logs.forEach((log) => {
        itemsMap.set(log.id, log);
      });
      timeLogsStore.set({ items: itemsMap });

      // Use range=2 (2 months before and after January 2026)
      const store = createCalendarStore(2026, 1, 2, timers, targets);
      const value = get(store);

      expect(value.timeLogsByDate.has('2025-11-15')).toBe(true);
      expect(value.timeLogsByDate.has('2026-03-15')).toBe(true);
    });
  });
});
