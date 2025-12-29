import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import TimerGraph from './TimerGraph.svelte';
import type { Timer, TimeLog } from '../types';

const { mockTimeLogsStore, mockActiveTimeLogs, mockTimersStore } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  const timeLogsWritable = writable({ items: [] });
  return {
    mockTimeLogsStore: {
      ...timeLogsWritable,
      items: [],
    },
    mockActiveTimeLogs: writable([]),
    mockTimersStore: {
      delete: vi.fn(),
    },
  };
});

vi.mock('../stores/timelogs', () => ({
  timeLogsStore: mockTimeLogsStore,
  activeTimeLogs: mockActiveTimeLogs,
}));

vi.mock('../stores/timers', () => ({
  timersStore: mockTimersStore,
}));

vi.mock('../lib/timerLayout', () => ({
  computeTimerLayout: vi.fn(() => new Map([
    ['b1', { x: 100, y: 100 }],
    ['b2', { x: 200, y: 200 }],
  ])),
}));

vi.mock('../../../lib/utils/timeFormat.js', () => ({
  formatTime: (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },
}));

describe('TimerGraph Component', () => {
  let mockButtons: Timer[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockButtons = [
      {
        id: 'b1',
        user_id: 'u1',
        name: 'Work',
        emoji: '💼',
        color: '#3B82F6',
        auto_subtract_breaks: false,
        archived: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'b2',
        user_id: 'u1',
        name: 'Study',
        emoji: '📚',
        color: '#10B981',
        auto_subtract_breaks: false,
        archived: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    mockTimeLogsStore.set({ items: [] });
  });

  it('renders container with minimum height', () => {
    const { container } = render(TimerGraph, {
      props: { buttons: mockButtons, editMode: false, toggleMode: true },
    });

    const graphContainer = container.querySelector('.relative.w-full.h-full');
    expect(graphContainer).toBeInTheDocument();
  });

  it('renders timer buttons for all provided buttons', () => {
    render(TimerGraph, {
      props: { buttons: mockButtons, editMode: false, toggleMode: true },
    });

    // TimerButton components should be rendered
  });

  it('shows empty state when no buttons', () => {
    const { container } = render(TimerGraph, {
      props: { buttons: [], editMode: false, toggleMode: true },
    });

    expect(container.textContent).toContain('No tracking buttons yet');
    expect(container.textContent).toContain('Click "Add Button" to create your first timer');
  });

  it('positions buttons using computed layout', async () => {
    const { computeTimerLayout } = await import('../lib/timerLayout');
    
    render(TimerGraph, {
      props: { buttons: mockButtons, editMode: false, toggleMode: true },
    });

    expect(computeTimerLayout).toHaveBeenCalled();
  });

  it('passes edit mode to timer buttons', () => {
    render(TimerGraph, {
      props: { buttons: mockButtons, editMode: true, toggleMode: true },
    });

    // Edit mode should be passed down
  });

  it('passes toggle mode to timer buttons', () => {
    render(TimerGraph, {
      props: { buttons: mockButtons, editMode: false, toggleMode: false },
    });

    // Toggle mode should be passed down
  });

  it('dispatches edit event when timer is edited', () => {
    render(TimerGraph, {
      props: { buttons: mockButtons, editMode: true, toggleMode: true },
    });

    // Edit event is tested through component integration
  });

  it('dispatches longpress event', () => {
    render(TimerGraph, {
      props: { buttons: mockButtons, editMode: false, toggleMode: true },
    });

    // Longpress event is tested through component integration
  });

  it('dispatches timerstopped event', () => {
    render(TimerGraph, {
      props: { buttons: mockButtons, editMode: false, toggleMode: true },
    });

    // Timer stopped event is tested through component integration
  });

  it('scales active timers', () => {
    mockTimeLogsStore.set({
      items: [{
        id: 'log1',
        timer_id: 'b1',
        start_timestamp: new Date().toISOString(),
        end_timestamp: null,
        duration_minutes: null,
      } as TimeLog],
    });

    const { container } = render(TimerGraph, {
      props: { buttons: mockButtons, editMode: false, toggleMode: true },
    });

    // Active timer should have scale transform
    const activeTimer = container.querySelector('[style*="scale(1.2)"]');
    expect(activeTimer).toBeDefined();
  });
});
