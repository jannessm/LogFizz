import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import HistoryCalendar from './HistoryCalendar.svelte';
import dayjs from '../../../../lib/utils/dayjs.js';
import type { CalendarTimeLogData, MultiDayRangeInfo } from '../../services/calendar';
import type { Timer, TimeLog, TargetWithSpecs, Holiday } from '../../types';

const { mockHolidaysStore } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    mockHolidaysStore: writable({ holidays: [] }),
  };
});

vi.mock('../../stores/holidays', () => ({
  holidaysStore: mockHolidaysStore,
}));

// Helper to create mock calendar data
function createMockCalendarData(timeLogs: TimeLog[], timers: Timer[]): CalendarTimeLogData {
  const timeLogsByDate = new Map<string, TimeLog[]>();
  const dotColors = new Map<string, string[]>();
  const multiDayRanges = new Map<string, MultiDayRangeInfo>();
  const relevantHolidays = new Map<string, Holiday[]>();

  for (const log of timeLogs) {
    const date = dayjs(log.start_timestamp).format('YYYY-MM-DD');
    if (!timeLogsByDate.has(date)) {
      timeLogsByDate.set(date, []);
    }
    timeLogsByDate.get(date)!.push(log);

    const timer = timers.find(t => t.id === log.timer_id);
    if (timer) {
      const colors = dotColors.get(date) || [];
      if (!colors.includes(timer.color!)) {
        colors.push(timer.color!);
      }
      dotColors.set(date, colors);
    }
  }

  return { timeLogsByDate, dotColors, multiDayRanges, relevantHolidays };
}

describe('HistoryCalendar Component', () => {
  let mockTimers: Timer[];
  let mockTimeLogs: TimeLog[];
  let mockTargets: TargetWithSpecs[];
  let mockCalendarData: CalendarTimeLogData;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockTimers = [
      { id: 'b1', user_id: 'u1', name: 'Work', color: '#3B82F6', auto_subtract_breaks: false, archived: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
      { id: 'b2', user_id: 'u1', name: 'Study', color: '#10B981', auto_subtract_breaks: false, archived: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
    ];

    mockTimeLogs = [
      {
        id: 'l1',
        timer_id: 'b1',
        type: 'normal',
        whole_day: false,
        apply_break_calculation: false,
        start_timestamp: '2024-01-15T09:00:00Z',
        end_timestamp: '2024-01-15T17:00:00Z',
        duration_minutes: 480,
        timezone: 'UTC',
      } as TimeLog,
      {
        id: 'l2',
        timer_id: 'b2',
        type: 'normal',
        whole_day: false,
        apply_break_calculation: false,
        start_timestamp: '2024-01-20T18:00:00Z',
        end_timestamp: '2024-01-20T20:00:00Z',
        duration_minutes: 120,
        timezone: 'UTC',
      } as TimeLog,
    ];

    mockTargets = [];
    mockCalendarData = createMockCalendarData(mockTimeLogs, mockTimers);
  });

  it('renders calendar component', () => {
    const { container } = render(HistoryCalendar, {
      props: {
        timeLogs: mockTimeLogs,
        calendarData: mockCalendarData,
        selectedDate: { date: dayjs('2024-01-15'), month: dayjs('2024-01-01') },
      },
    });

    expect(container).toBeInTheDocument();
  });

  it('renders calendar grid', () => {
    const { container } = render(HistoryCalendar, {
      props: {
        timeLogs: mockTimeLogs,
        calendarData: mockCalendarData,
        selectedDate: { date: dayjs('2024-01-15'), month: dayjs('2024-01-01') },
      },
    });

    expect(container).toBeInTheDocument();
  });

  it('renders with correct structure', () => {
    const { container } = render(HistoryCalendar, {
      props: {
        timeLogs: mockTimeLogs,
        calendarData: mockCalendarData,
        selectedDate: { date: dayjs('2024-01-15'), month: dayjs('2024-01-01') },
      },
    });

    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('displays color indicators for days with logs', () => {
    const { container } = render(HistoryCalendar, {
      props: {
        timeLogs: mockTimeLogs,
        calendarData: mockCalendarData,
        selectedDate: { date: dayjs('2024-01-15'), month: dayjs('2024-01-01') },
      },
    });

    expect(container).toBeInTheDocument();
  });

  it('handles holidays display', () => {
    const holidayCalendarData = { ...mockCalendarData };
    holidayCalendarData.relevantHolidays = new Map([
      ['2024-01-01', [{ id: 'h1', date: '2024-01-01', name: 'New Year', country: 'DE', global: true, counties: [], year: 2024 }]],
    ]);

    const { container } = render(HistoryCalendar, {
      props: {
        timeLogs: mockTimeLogs,
        calendarData: holidayCalendarData,
        selectedDate: { date: dayjs('2024-01-15'), month: dayjs('2024-01-01') },
      },
    });

    expect(container).toBeInTheDocument();
  });

  it('handles empty time logs', () => {
    const emptyCalendarData = createMockCalendarData([], mockTimers);

    const { container } = render(HistoryCalendar, {
      props: {
        timeLogs: [],
        calendarData: emptyCalendarData,
        selectedDate: { date: dayjs('2024-01-15'), month: dayjs('2024-01-01') },
      },
    });

    expect(container).toBeInTheDocument();
  });
});
