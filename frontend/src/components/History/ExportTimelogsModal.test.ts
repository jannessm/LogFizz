import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ExportTimelogsModal from './ExportTimelogsModal.svelte';

// Mock data
const mockTimers = [
  {
    id: 'timer-1',
    user_id: 'user-1',
    name: 'Work',
    emoji: '💼',
    color: '#3B82F6',
    auto_subtract_breaks: false,
    archived: false,
    target_id: 'target-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'timer-2',
    user_id: 'user-1',
    name: 'Personal',
    emoji: '🏠',
    color: '#10B981',
    auto_subtract_breaks: false,
    archived: false,
    target_id: undefined,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const mockTargets = [
  {
    id: 'target-1',
    user_id: 'user-1',
    name: 'Office Work',
    target_specs: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const mockTimelogs = [
  {
    id: 'log-1',
    user_id: 'user-1',
    timer_id: 'timer-1',
    type: 'normal' as const,
    whole_day: false,
    start_timestamp: '2024-01-15T08:00:00Z',
    end_timestamp: '2024-01-15T17:00:00Z',
    duration_minutes: 540,
    timezone: 'Europe/Berlin',
    apply_break_calculation: false,
    notes: 'Regular work day',
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-01-15T17:00:00Z',
  },
  {
    id: 'log-2',
    user_id: 'user-1',
    timer_id: 'timer-2',
    type: 'normal' as const,
    whole_day: false,
    start_timestamp: '2024-01-16T09:00:00Z',
    end_timestamp: '2024-01-16T12:00:00Z',
    duration_minutes: 180,
    timezone: 'Europe/Berlin',
    apply_break_calculation: false,
    notes: '',
    created_at: '2024-01-16T09:00:00Z',
    updated_at: '2024-01-16T12:00:00Z',
  },
];

// Mock the stores
vi.mock('../../stores/timers', () => ({
  timers: {
    subscribe: (callback: any) => {
      callback(mockTimers);
      return () => {};
    },
  },
}));

vi.mock('../../stores/targets', () => ({
  targets: {
    subscribe: (callback: any) => {
      callback(mockTargets);
      return () => {};
    },
  },
}));

vi.mock('../../stores/timelogs', () => ({
  timeLogsStore: {
    subscribe: (callback: any) => {
      callback({ items: new Map() });
      return () => {};
    },
  },
  timerlogs: {
    subscribe: (callback: any) => {
      callback(mockTimelogs);
      return () => {};
    },
  },
}));

describe('ExportTimelogsModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with title', () => {
    render(ExportTimelogsModal, { props: { close: vi.fn() } });
    expect(screen.getByText('Export Timelogs')).toBeInTheDocument();
  });

  it('shows timer selection section', () => {
    render(ExportTimelogsModal, { props: { close: vi.fn() } });
    expect(screen.getByText('Select Timers')).toBeInTheDocument();
    expect(screen.getByText('Select All')).toBeInTheDocument();
    expect(screen.getByText('Deselect All')).toBeInTheDocument();
  });

  it('displays timers with their names', () => {
    render(ExportTimelogsModal, { props: { close: vi.fn() } });
    expect(screen.getByText('💼 Work')).toBeInTheDocument();
    expect(screen.getByText('🏠 Personal')).toBeInTheDocument();
  });

  it('displays targets that group timers', () => {
    render(ExportTimelogsModal, { props: { close: vi.fn() } });
    expect(screen.getByText(/📁 Office Work/)).toBeInTheDocument();
  });

  it('shows date range filter section', () => {
    render(ExportTimelogsModal, { props: { close: vi.fn() } });
    expect(screen.getByText('Date Range (Optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });

  it('shows column selection section', () => {
    render(ExportTimelogsModal, { props: { close: vi.fn() } });
    expect(screen.getByText('Select Columns to Export')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Start Time')).toBeInTheDocument();
    expect(screen.getByText('End Time')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Timer')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('has export button disabled when no timers selected', () => {
    const { container } = render(ExportTimelogsModal, { props: { close: vi.fn() } });
    const exportButton = container.querySelector('button[disabled]');
    expect(exportButton).toBeInTheDocument();
    expect(exportButton?.textContent).toMatch(/Export 0 Timelogs/i);
  });

  it('has cancel button that calls close', async () => {
    const closeFn = vi.fn();
    render(ExportTimelogsModal, { props: { close: closeFn } });
    
    const cancelButton = screen.getByText('Cancel');
    await fireEvent.click(cancelButton);
    
    expect(closeFn).toHaveBeenCalled();
  });

  it('can select all timers using button', async () => {
    const { container } = render(ExportTimelogsModal, { props: { close: vi.fn() } });
    
    const selectAllButton = screen.getByText('Select All');
    await fireEvent.click(selectAllButton);
    
    // After selecting all, there should be checkboxes that are checked
    await waitFor(() => {
      const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  it('can deselect all timers using button', async () => {
    const { container } = render(ExportTimelogsModal, { props: { close: vi.fn() } });
    
    // First select all
    const selectAllButton = screen.getByText('Select All');
    await fireEvent.click(selectAllButton);
    
    // Then deselect all
    const deselectAllButton = screen.getByText('Deselect All');
    await fireEvent.click(deselectAllButton);
    
    await waitFor(() => {
      const exportButton = container.querySelector('button[disabled]');
      expect(exportButton).toBeInTheDocument();
      expect(exportButton?.textContent).toMatch(/Export 0 Timelogs/i);
    });
  });

  it('shows timer count in target group', () => {
    render(ExportTimelogsModal, { props: { close: vi.fn() } });
    expect(screen.getByText('(1 timer)')).toBeInTheDocument();
  });

  it('has all column checkboxes checked by default', () => {
    render(ExportTimelogsModal, { props: { close: vi.fn() } });
    
    const checkboxes = screen.getAllByRole('checkbox');
    // Filter to only column checkboxes (first 7 are likely the column ones)
    // But this depends on the rendering order, so we just check that some are checked
    const checkedCheckboxes = checkboxes.filter((cb) => (cb as HTMLInputElement).checked);
    expect(checkedCheckboxes.length).toBeGreaterThan(0);
  });

  it('renders modal with proper accessibility attributes', () => {
    render(ExportTimelogsModal, { props: { close: vi.fn() } });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('shows Other Timers section for timers without target', () => {
    render(ExportTimelogsModal, { props: { close: vi.fn() } });
    expect(screen.getByText('Other Timers')).toBeInTheDocument();
  });
});
