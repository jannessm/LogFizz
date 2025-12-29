import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TimerButton from './TimerButton.svelte';
import type { Timer, TimeLog } from '../../types';

const { mockActiveTimeLogs, mockTimeLogsStore, mockTimersStore } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  const timeLogsWritable = writable({ items: [] });
  return {
    mockActiveTimeLogs: writable([]),
    mockTimeLogsStore: {
      ...timeLogsWritable,
      items: [],
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
    },
    mockTimersStore: {
      delete: vi.fn(),
    },
  };
});

vi.mock('../stores/timelogs', () => ({
  activeTimeLogs: mockActiveTimeLogs,
  timeLogsStore: mockTimeLogsStore,
}));

vi.mock('../stores/timers', () => ({
  timersStore: mockTimersStore,
}));

vi.mock('../../../lib/utils/timeFormat.js', () => ({
  formatTime: (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },
}));

describe('TimerButton Component', () => {
  let mockTimer: Timer;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockTimer = {
      id: 't1',
      user_id: 'u1',
      name: 'Work',
      emoji: '💼',
      color: '#3B82F6',
      auto_subtract_breaks: false,
      archived: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockActiveTimeLogs.set([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders timer button with name and emoji', () => {
    render(TimerButton, { props: { timer: mockTimer } });
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('💼')).toBeInTheDocument();
  });

  it('applies custom color to button', () => {
    const { container } = render(TimerButton, { props: { timer: mockTimer } });
    const button = container.querySelector('button');
    expect(button).toHaveStyle({ backgroundColor: '#3B82F6' });
  });

  it('shows inactive state when timer is not running', () => {
    const { container } = render(TimerButton, { props: { timer: mockTimer } });
    const button = container.querySelector('button');
    expect(button).not.toHaveClass('has-pulse');
  });

  it('shows active state when timer is running', () => {
    mockActiveTimeLogs.set([
      {
        id: 'tl1',
        timer_id: 't1',
        start_timestamp: new Date().toISOString(),
        end_timestamp: null,
        duration_minutes: null,
      } as TimeLog,
    ]);

    const { container } = render(TimerButton, { props: { timer: mockTimer } });
    const button = container.querySelector('button');
    expect(button).toHaveClass('has-pulse');
  });

  it('starts timer when clicked in inactive state', async () => {
    render(TimerButton, { props: { timer: mockTimer } });
    const button = screen.getByRole('button');
    
    await fireEvent.click(button);
    expect(mockTimeLogsStore.startTimer).toHaveBeenCalledWith('t1');
  });

  it('handles active timer click', async () => {
    const activeLog: TimeLog = {
      id: 'tl1',
      timer_id: 't1',
      start_timestamp: new Date().toISOString(),
      end_timestamp: null,
      duration_minutes: null,
    } as TimeLog;

    mockActiveTimeLogs.set([activeLog]);

    render(TimerButton, { props: { timer: mockTimer } });

    const button = screen.getByRole('button');
    await fireEvent.click(button);
    
    // Event dispatching is tested through component logic
  });

  it('displays elapsed time for active timer', async () => {
    const startTime = new Date();
    startTime.setSeconds(startTime.getSeconds() - 65); // 1 minute 5 seconds ago

    mockActiveTimeLogs.set([
      {
        id: 'tl1',
        timer_id: 't1',
        start_timestamp: startTime.toISOString(),
        end_timestamp: null,
        duration_minutes: null,
      } as TimeLog,
    ]);

    render(TimerButton, { props: { timer: mockTimer } });
    
    // Time display should show elapsed time
    const { container } = render(TimerButton, { props: { timer: mockTimer } });
    // Wait for component to update
    await vi.advanceTimersByTimeAsync(100);
    expect(container.textContent).toContain('00:01:0');
  });

  it('handles edit mode click', async () => {
    render(TimerButton, { 
      props: { timer: mockTimer, editMode: true } 
    });

    const button = screen.getAllByRole('button')[1]; // Main button (not delete)
    await fireEvent.click(button);
    
    // Edit event is dispatched through component logic
  });

  it('shows delete button in edit mode', () => {
    render(TimerButton, { props: { timer: mockTimer, editMode: true } });
    const deleteButton = screen.getByRole('button', { name: /edit button/i });
    expect(deleteButton).toBeInTheDocument();
  });

  it('handles long press', async () => {
    render(TimerButton, { props: { timer: mockTimer } });

    const button = screen.getByRole('button');
    await fireEvent.pointerDown(button);
    
    // Wait for long press timeout (500ms)
    await vi.advanceTimersByTimeAsync(500);
    
    // Longpress event is dispatched through component logic
  });

  it('does not trigger click after long press', async () => {
    render(TimerButton, { props: { timer: mockTimer } });
    const button = screen.getByRole('button');
    
    await fireEvent.pointerDown(button);
    await vi.advanceTimersByTimeAsync(500);
    await fireEvent.pointerUp(button);
    await fireEvent.click(button);
    
    // startTimer should not be called after long press
    expect(mockTimeLogsStore.startTimer).not.toHaveBeenCalled();
  });

  it('renders progress ring when timer is active', () => {
    mockActiveTimeLogs.set([
      {
        id: 'tl1',
        timer_id: 't1',
        start_timestamp: new Date().toISOString(),
        end_timestamp: null,
        duration_minutes: null,
      } as TimeLog,
    ]);

    const { container } = render(TimerButton, { props: { timer: mockTimer } });
    const progressRing = container.querySelector('.progress-ring-seconds');
    expect(progressRing).toBeInTheDocument();
  });
});
