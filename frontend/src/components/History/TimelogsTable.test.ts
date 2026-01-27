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
    expect(screen.getByText('Duration')).toBeInTheDocument();
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

    expect(screen.getByText('8h 0m')).toBeInTheDocument(); // 480 minutes
    expect(screen.getByText('2h 0m')).toBeInTheDocument(); // 120 minutes
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

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = vi.fn();
    
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
        onEdit,
      }
    });

    const editButtons = screen.getAllByTitle('Edit in form');
    await fireEvent.click(editButtons[0]);

    expect(onEdit).toHaveBeenCalledWith(mockTimelogs[0]);
  });

  it('calls onDelete when delete button is clicked', async () => {
    const onDelete = vi.fn();
    
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
        onDelete,
      }
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await fireEvent.click(deleteButtons[0]);

    expect(onDelete).toHaveBeenCalledWith(mockTimelogs[0]);
  });

  it('shows inline edit button when editMode is true', () => {
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
        editMode: true,
      }
    });

    const inlineEditButtons = screen.getAllByTitle('Edit inline');
    expect(inlineEditButtons.length).toBe(3);
  });

  it('allows inline editing when edit mode is enabled', async () => {
    const onSave = vi.fn();
    
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
        editMode: true,
        onSave,
      }
    });

    // Click inline edit button
    const inlineEditButtons = screen.getAllByTitle('Edit inline');
    await fireEvent.click(inlineEditButtons[0]);

    // Should show save and cancel buttons
    expect(screen.getByTitle('Save')).toBeInTheDocument();
    expect(screen.getByTitle('Cancel')).toBeInTheDocument();
  });

  it('hides action column when showActions is false and editMode is false', () => {
    render(TimelogsTable, {
      props: {
        timelogs: mockTimelogs,
        timers: mockTimers,
        targets: mockTargets,
        showActions: false,
        editMode: false,
      }
    });

    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
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
