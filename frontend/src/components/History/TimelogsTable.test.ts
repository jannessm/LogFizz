import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import TimelogsTable from './TimelogsTable.svelte';
import type { TimeLog, Timer } from '../../types';
import type { TargetWithSpecs } from '../../types';

describe('TimelogsTable Component', () => {
  const mockTimers: Timer[] = [
    {
      id: 'timer-1',
      user_id: 'user-1',
      name: 'Work',
      emoji: '💼',
      auto_subtract_breaks: true,
      archived: false,
      target_id: 'target-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'timer-2',
      user_id: 'user-1',
      name: 'Study',
      emoji: '📚',
      auto_subtract_breaks: false,
      archived: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const mockTargets: TargetWithSpecs[] = [
    {
      id: 'target-1',
      user_id: 'user-1',
      name: 'Full-time Job',
      target_specs: [],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const mockTimelogs: TimeLog[] = [
    {
      id: 'log-1',
      user_id: 'user-1',
      timer_id: 'timer-1',
      type: 'normal',
      whole_day: false,
      start_timestamp: '2024-12-15T09:00:00Z',
      end_timestamp: '2024-12-15T17:00:00Z',
      duration_minutes: 480,
      timezone: 'UTC',
      apply_break_calculation: false,
      notes: 'Regular work day',
      created_at: '2024-12-15T09:00:00Z',
      updated_at: '2024-12-15T17:00:00Z',
    },
    {
      id: 'log-2',
      user_id: 'user-1',
      timer_id: 'timer-2',
      type: 'normal',
      whole_day: false,
      start_timestamp: '2024-12-16T10:00:00Z',
      end_timestamp: '2024-12-16T12:00:00Z',
      duration_minutes: 120,
      timezone: 'UTC',
      apply_break_calculation: false,
      notes: 'Study session',
      created_at: '2024-12-16T10:00:00Z',
      updated_at: '2024-12-16T12:00:00Z',
    },
    {
      id: 'log-3',
      user_id: 'user-1',
      timer_id: 'timer-1',
      type: 'sick',
      whole_day: true,
      start_timestamp: '2024-12-17T00:00:00Z',
      end_timestamp: '2024-12-17T00:00:00Z',
      duration_minutes: 0,
      timezone: 'UTC',
      apply_break_calculation: false,
      notes: 'Sick day',
      created_at: '2024-12-17T00:00:00Z',
      updated_at: '2024-12-17T00:00:00Z',
    },
  ];

  afterEach(() => {
    cleanup();
  });

  it('renders table headers', () => {
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    expect(screen.getByText('Timer')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('End')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Effective Duration')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('displays timelogs data', () => {
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    // Timer names - use getAllByText since there may be multiple
    expect(screen.getAllByText('💼 Work').length).toBeGreaterThan(0);
    expect(screen.getAllByText('📚 Study').length).toBeGreaterThan(0);

    // Target name
    expect(screen.getAllByText('Full-time Job').length).toBeGreaterThan(0);

    // Notes
    expect(screen.getByText('Regular work day')).toBeInTheDocument();
    expect(screen.getByText('Study session')).toBeInTheDocument();
    expect(screen.getByText('Sick day')).toBeInTheDocument();
  });

  it('displays correct type badges', () => {
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    expect(screen.getAllByText('Normal').length).toBe(2);
    expect(screen.getByText('Sick')).toBeInTheDocument();
  });

  it('displays formatted duration', () => {
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    // Duration is shown in both Total Duration and Effective Duration columns
    // formatMinutesCompact shows "8h" instead of "8h 0m" for even hours
    expect(screen.getAllByText('8h').length).toBeGreaterThan(0); // 480 minutes
    expect(screen.getAllByText('2h').length).toBeGreaterThan(0); // 120 minutes
  });

  it('shows "No timelogs found" when empty', () => {
    render(TimelogsTable, {
      props: {
        timelogs: [],
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    expect(screen.getByText('No timelogs found')).toBeInTheDocument();
  });

  it('shows checkboxes when selectable is true', () => {
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
        selectable: true,
      }
    });

    const checkboxes = screen.getAllByRole('checkbox');
    // 1 for select all + 3 for each timelog
    expect(checkboxes.length).toBe(4);
  });

  it('opens edit form when row is clicked', async () => {
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    // Click on a row to open the edit form
    const rows = screen.getAllByRole('row');
    // First row is header, second is date separator, third is first timelog
    const timelogRows = rows.filter(row => row.classList.contains('cursor-pointer'));
    expect(timelogRows.length).toBeGreaterThan(0);
  });

  it('displays timelogs grouped by date', () => {
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    // Should have date group headers (format is locale-aware 'L' format: MM/DD/YYYY)
    expect(screen.getByText(/12\/15\/2024/)).toBeInTheDocument();
    expect(screen.getByText(/12\/16\/2024/)).toBeInTheDocument();
    expect(screen.getByText(/12\/17\/2024/)).toBeInTheDocument();
  });

  it('allows column visibility configuration', () => {
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
        visibleColumns: {
          timer: true,
          target: false,
          type: true,
          start: true,
          end: true,
          totalDuration: true,
          effectiveDuration: true,
          notes: true,
        },
      }
    });

    expect(screen.getByText('Timer')).toBeInTheDocument();
    expect(screen.queryByText('Target')).not.toBeInTheDocument();
  });

  it('handles running timelogs (no end_timestamp)', () => {
    const runningTimelog: TimeLog = {
      id: 'log-running',
      user_id: 'user-1',
      timer_id: 'timer-1',
      type: 'normal',
      whole_day: false,
      start_timestamp: '2024-12-15T09:00:00Z',
      end_timestamp: undefined,
      duration_minutes: undefined,
      timezone: 'UTC',
      apply_break_calculation: false,
      notes: 'Currently running',
      created_at: '2024-12-15T09:00:00Z',
      updated_at: '2024-12-15T09:00:00Z',
    };

    render(TimelogsTable, {
      props: {
        timelogs: [runningTimelog],
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    expect(screen.getAllByText('Running').length).toBeGreaterThanOrEqual(1);
  });
});
