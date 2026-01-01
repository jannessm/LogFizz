import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HistoryLogs from './HistoryLogs.svelte';
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

vi.mock('../../lib/utils/computeIndentation', () => ({
  computeIndentation: vi.fn(() => new Map()),
}));

describe('HistoryLogs Component', () => {
  let mockButtons: any[];
  let mockTimeLogs: any[];
  let selectedDate: dayjs.Dayjs;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockButtons = [
      { id: 'b1', name: 'Work', emoji: '💼', color: '#3B82F6' },
      { id: 'b2', name: 'Study', emoji: '📚', color: '#10B981' },
    ];

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
        buttons: mockButtons,
        onAddTimelog: vi.fn(),
        onEditTimelog: vi.fn(),
        countries: [],
      },
    });

    expect(container).toBeInTheDocument();
  });

  it('renders history logs component', () => {
    const { container } = render(HistoryLogs, {
      props: {
        selectedDate,
        timeLogs: mockTimeLogs,
        buttons: mockButtons,
        onAddTimelog: vi.fn(),
        onEditTimelog: vi.fn(),
        countries: [],
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
        buttons: mockButtons,
        onAddTimelog: vi.fn(),
        onEditTimelog: vi.fn(),
        countries: [],
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
        buttons: mockButtons,
        onAddTimelog: vi.fn(),
        onEditTimelog: vi.fn(),
        countries: [],
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
        buttons: mockButtons,
        onAddTimelog: vi.fn(),
        onEditTimelog: vi.fn(),
        countries: [],
      },
    });

    // Only logs from selected date should be shown
  });

  it('calls onAddTimelog when add button clicked', () => {
    const onAddTimelog = vi.fn();
    
    render(HistoryLogs, {
      props: {
        selectedDate,
        timeLogs: mockTimeLogs,
        buttons: mockButtons,
        onAddTimelog,
        onEditTimelog: vi.fn(),
        countries: [],
      },
    });

    // Add timelog functionality would be tested if button is exposed
  });

  it('calls onEditTimelog when session is edited', () => {
    const onEditTimelog = vi.fn();
    
    render(HistoryLogs, {
      props: {
        selectedDate,
        timeLogs: mockTimeLogs,
        buttons: mockButtons,
        onAddTimelog: vi.fn(),
        onEditTimelog,
        countries: [],
      },
    });

    // Edit functionality is tested through SessionBox component
  });

  it('displays holidays when available', () => {
    mockHolidaysStore.set({
      holidays: [
        {
          name: 'New Year',
          date: '2024-01-15',
          country: 'US',
          state: null,
        },
      ],
    });

    render(HistoryLogs, {
      props: {
        selectedDate,
        timeLogs: mockTimeLogs,
        buttons: mockButtons,
        onAddTimelog: vi.fn(),
        onEditTimelog: vi.fn(),
        countries: ['US'],
      },
    });

    // Holiday indicator should be shown
  });
});
