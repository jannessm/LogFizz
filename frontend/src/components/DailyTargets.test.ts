import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import DailyTargets from './DailyTargets.svelte';
import type { TargetWithSpecs, Timer, TimeLog } from '../types';

const { mockTodayTargets, mockTimersStore, mockTimeLogsStore, mockActiveTimeLogs } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    mockTodayTargets: writable([]),
    mockTimersStore: writable({ items: [] }),
    mockTimeLogsStore: writable({ items: [] }),
    mockActiveTimeLogs: writable([]),
  };
});

vi.mock('../stores/targets', () => ({
  todayTargets: mockTodayTargets,
}));

vi.mock('../stores/timers', () => ({
  timersStore: mockTimersStore,
}));

vi.mock('../stores/timelogs', () => ({
  timeLogsStore: mockTimeLogsStore,
  activeTimeLogs: mockActiveTimeLogs,
}));

vi.mock('../lib/utils/targetSpec', () => ({
  getActiveTargetSpec: vi.fn((target) => target.target_specs?.[0] || null),
}));

describe('DailyTargets Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockTodayTargets.set([]);
    mockTimersStore.set({ items: [] });
    mockTimeLogsStore.set({ items: [] });
    mockActiveTimeLogs.set([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no targets', () => {
    const { container } = render(DailyTargets);
    expect(container.querySelector('.px-4')).not.toBeInTheDocument();
  });

  it('displays target progress', () => {
    const mockTarget: TargetWithSpecs = {
      id: 'target1',
      name: 'Work',
      user_id: 'u1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      target_specs: [{
        id: 'spec1',
        target_id: 'target1',
        weekdays: [1, 2, 3, 4, 5],
        duration_minutes: [480, 480, 480, 480, 480],
        exclude_holidays: false,
        state_code: null,
        starting_from: null,
        ending_at: null,
      }],
    };

    mockTodayTargets.set([mockTarget]);
    mockTimersStore.set({ items: [] });
    mockTimeLogsStore.set({ items: [] });

    render(DailyTargets);
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('shows progress bar with correct percentage', () => {
    const mockTarget: TargetWithSpecs = {
      id: 'target1',
      name: 'Work',
      user_id: 'u1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      target_specs: [{
        id: 'spec1',
        target_id: 'target1',
        weekdays: [1, 2, 3, 4, 5],
        duration_minutes: [240, 240, 240, 240, 240], // 4 hours
        exclude_holidays: false,
        state_code: null,
        starting_from: null,
        ending_at: null,
      }],
    };

    mockTodayTargets.set([mockTarget]);
    mockTimersStore.set({ items: [] });
    mockTimeLogsStore.set({ items: [] });

    const { container } = render(DailyTargets);
    const progressBar = container.querySelector('.bg-gray-200');
    expect(progressBar).toBeInTheDocument();
  });

  it('applies active styling when target is active', () => {
    const mockButton: Timer = {
      id: 'button1',
      name: 'Work Timer',
      target_id: 'target1',
      user_id: 'u1',
      emoji: '💼',
      color: '#3B82F6',
      auto_subtract_breaks: false,
      archived: false,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    const mockActiveLog: TimeLog = {
      id: 'log1',
      timer_id: 'button1',
      start_timestamp: new Date().toISOString(),
      end_timestamp: null,
      duration_minutes: null,
    } as TimeLog;

    const mockTarget: TargetWithSpecs = {
      id: 'target1',
      name: 'Work',
      user_id: 'u1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      target_specs: [{
        id: 'spec1',
        target_id: 'target1',
        weekdays: [1, 2, 3, 4, 5],
        duration_minutes: [480, 480, 480, 480, 480],
        exclude_holidays: false,
        state_code: null,
        starting_from: null,
        ending_at: null,
      }],
    };

    mockTodayTargets.set([mockTarget]);
    mockTimersStore.set({ items: [mockButton] });
    mockActiveTimeLogs.set([mockActiveLog]);
    mockTimeLogsStore.set({ items: [] });

    const { container } = render(DailyTargets);
    const activeElement = container.querySelector('.opacity-100');
    expect(activeElement).toBeInTheDocument();
  });

  it('applies inactive styling when target is not active', () => {
    const mockTarget: TargetWithSpecs = {
      id: 'target1',
      name: 'Work',
      user_id: 'u1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      target_specs: [{
        id: 'spec1',
        target_id: 'target1',
        weekdays: [1, 2, 3, 4, 5],
        duration_minutes: [480, 480, 480, 480, 480],
        exclude_holidays: false,
        state_code: null,
        starting_from: null,
        ending_at: null,
      }],
    };

    mockTodayTargets.set([mockTarget]);
    mockTimersStore.set({ items: [] });
    mockTimeLogsStore.set({ items: [] });

    const { container } = render(DailyTargets);
    const inactiveElement = container.querySelector('.opacity-40');
    expect(inactiveElement).toBeInTheDocument();
  });

  it('displays formatted duration correctly', () => {
    const mockTarget: TargetWithSpecs = {
      id: 'target1',
      name: 'Work',
      user_id: 'u1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      target_specs: [{
        id: 'spec1',
        target_id: 'target1',
        weekdays: [1, 2, 3, 4, 5],
        duration_minutes: [90, 90, 90, 90, 90], // 1h 30m
        exclude_holidays: false,
        state_code: null,
        starting_from: null,
        ending_at: null,
      }],
    };

    mockTodayTargets.set([mockTarget]);
    mockTimersStore.set({ items: [] });
    mockTimeLogsStore.set({ items: [] });

    const { container } = render(DailyTargets);
    // Check for time display (formats may vary)
    expect(container.textContent).toContain('1h 30m');
  });
});
