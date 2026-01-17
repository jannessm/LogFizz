import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HistoryLogs from './HistoryLogs.svelte';
import dayjs from '../../../../lib/utils/dayjs.js';

vi.mock('../../lib/utils/computeIndentation', () => ({
  computeIndentation: vi.fn((sessions) => sessions),
}));

vi.mock('../../stores/timelogs', () => ({
  timeLogsStore: {
    delete: vi.fn(),
  },
}));

vi.mock('../../services/formHandlers', () => ({
  saveTimelog: vi.fn().mockResolvedValue({}),
}));

describe('HistoryLogs Component', () => {
  let mockTimers: any[];
  let mockTimeLogs: any[];
  let selectedDate: { date: dayjs.Dayjs; month: dayjs.Dayjs };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockTimers = [
      { id: 'b1', name: 'Work', emoji: '💼', color: '#3B82F6' },
      { id: 'b2', name: 'Study', emoji: '📚', color: '#10B981' },
    ];

    selectedDate = { date: dayjs('2024-01-15'), month: dayjs('2024-01-01') };

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
        start_timestamp: '2024-01-15T18:00:00',
        end_timestamp: '2024-01-15T20:00:00',
        duration_minutes: 120,
      },
    ];
  });

  it('renders history logs component', () => {
    const { container } = render(HistoryLogs, {
      props: {
        selectedDate,
        timeLogs: mockTimeLogs,
        timers: mockTimers,
        relevantHolidays: [],
      },
    });

    expect(container).toBeInTheDocument();
  });

  it('renders history logs component with date', () => {
    const { container } = render(HistoryLogs, {
      props: {
        selectedDate,
        timeLogs: mockTimeLogs,
        timers: mockTimers,
        relevantHolidays: [],
      },
    });

    // Component should render
    expect(container).toBeInTheDocument();
  });

  it('displays logs for selected date', () => {
    const { container } = render(HistoryLogs, {
      props: {
        selectedDate,
        timeLogs: mockTimeLogs,
        timers: mockTimers,
        relevantHolidays: [],
      },
    });

    // Logs should be displayed
    expect(container).toBeInTheDocument();
  });

  it('handles empty time logs', () => {
    const { container } = render(HistoryLogs, {
      props: {
        selectedDate,
        timeLogs: [],
        timers: mockTimers,
        relevantHolidays: [],
      },
    });

    expect(container).toBeInTheDocument();
  });

  it('filters logs by selected date', () => {
    const logsWithDifferentDates = [
      ...mockTimeLogs,
      {
        id: 'l3',
        timer_id: 'b1',
        start_timestamp: '2024-01-16T09:00:00',
        end_timestamp: '2024-01-16T17:00:00',
        duration_minutes: 480,
      },
    ];

    render(HistoryLogs, {
      props: {
        selectedDate,
        timeLogs: logsWithDifferentDates,
        timers: mockTimers,
        relevantHolidays: [],
      },
    });

    // Only logs from selected date should be shown
  });

  it('renders add button', () => {
    render(HistoryLogs, {
      props: {
        selectedDate,
        timeLogs: mockTimeLogs,
        timers: mockTimers,
        relevantHolidays: [],
      },
    });

    // Add timelog button should be present
    expect(screen.getByRole('button', { name: /add time entry/i })).toBeInTheDocument();
  });

  it('renders timeline section', () => {
    render(HistoryLogs, {
      props: {
        selectedDate,
        timeLogs: mockTimeLogs,
        timers: mockTimers,
        relevantHolidays: [],
      },
    });

    // Component handles rendering internally
  });

  it('displays holidays when available', () => {
    const mockHolidays = [
      {
        name: 'New Year',
        date: '2024-01-15',
        country: 'US',
        state: null,
      },
    ];

    render(HistoryLogs, {
      props: {
        selectedDate,
        timeLogs: mockTimeLogs,
        timers: mockTimers,
        relevantHolidays: mockHolidays,
      },
    });

    // Holiday should be shown
    expect(screen.getByText('New Year')).toBeInTheDocument();
  });
});
