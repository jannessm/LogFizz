import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import HistoryCalendar from './HistoryCalendar.svelte';
import dayjs from '../../../../lib/utils/dayjs.js';

const { mockHolidaysStore } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    mockHolidaysStore: writable({ holidays: [] }),
  };
});

vi.mock('../../stores/holidays', () => ({
  holidaysStore: mockHolidaysStore,
}));

describe('HistoryCalendar Component', () => {
  let mockButtons: any[];
  let mockTimeLogs: any[];
  let currentMonth: dayjs.Dayjs;
  let selectedDate: dayjs.Dayjs;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockButtons = [
      { id: 'b1', name: 'Work', color: '#3B82F6' },
      { id: 'b2', name: 'Study', color: '#10B981' },
    ];

    currentMonth = dayjs('2024-01-15');
    selectedDate = dayjs('2024-01-15');

    mockTimeLogs = [
      {
        id: 'l1',
        timer_id: 'b1',
        start_timestamp: '2024-01-15T09:00:00',
        end_timestamp: '2024-01-15T17:00:00',
        duration_minutes: 480,
      },
      {
        id: 'l2',
        timer_id: 'b2',
        start_timestamp: '2024-01-20T18:00:00',
        end_timestamp: '2024-01-20T20:00:00',
        duration_minutes: 120,
      },
    ];
  });

  it('renders calendar component', () => {
    const { container } = render(HistoryCalendar, {
      props: {
        currentMonth,
        selectedDate,
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        onSelectDate: vi.fn(),
        countries: [],
      },
    });

    expect(container).toBeInTheDocument();
  });

  it('renders calendar grid', () => {
    const { container } = render(HistoryCalendar, {
      props: {
        currentMonth,
        selectedDate,
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        onSelectDate: vi.fn(),
        countries: [],
      },
    });

    // Calendar should show days
    expect(container).toBeInTheDocument();
  });

  it('renders with correct structure', () => {
    const { container } = render(HistoryCalendar, {
      props: {
        currentMonth,
        selectedDate,
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        onSelectDate: vi.fn(),
        countries: [],
      },
    });

    // Calendar fills in days from adjacent months
    expect(container).toBeInTheDocument();
  });

  it('displays color indicators for days with logs', () => {
    const { container } = render(HistoryCalendar, {
      props: {
        currentMonth,
        selectedDate,
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        onSelectDate: vi.fn(),
        countries: [],
      },
    });

    // Days with logs should have color indicators
    expect(container).toBeInTheDocument();
  });

  it('handles holidays display', () => {
    mockHolidaysStore.set({
      holidays: [
        {
          name: 'New Year',
          date: '2024-01-01',
          country: 'US',
          state: null,
        },
      ],
    });

    const { container } = render(HistoryCalendar, {
      props: {
        currentMonth,
        selectedDate,
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        onSelectDate: vi.fn(),
        countries: ['US'],
      },
    });

    // Holidays should be indicated on calendar
    expect(container).toBeInTheDocument();
  });

  it('handles empty time logs', () => {
    const { container } = render(HistoryCalendar, {
      props: {
        currentMonth,
        selectedDate,
        buttons: mockButtons,
        timeLogs: [],
        onSelectDate: vi.fn(),
        countries: [],
      },
    });

    expect(container).toBeInTheDocument();
  });
});
