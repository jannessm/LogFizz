import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import TableFilters, { type FilterState } from './TableFilters.svelte';
import type { Timer } from '../../types';
import type { TargetWithSpecs } from '../../types';
import dayjs from '../../../../lib/utils/dayjs.js';

describe('TableFilters Component', () => {
  const mockTimers: Timer[] = [
    {
      id: 'timer-1',
      user_id: 'user-1',
      name: 'Work',
      emoji: '💼',
      auto_subtract_breaks: true,
      archived: false,
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

  const defaultFilters: FilterState = {
    dateFrom: null,
    dateTo: null,
    timerIds: [],
    targetIds: [],
    types: [],
    searchText: '',
  };

  afterEach(() => {
    cleanup();
  });

  it('renders search input', () => {
    render(TableFilters, {
      props: {
        filters: defaultFilters,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    expect(screen.getByPlaceholderText(/Search notes, timers, targets/)).toBeInTheDocument();
  });

  it('renders date inputs (always visible)', () => {
    render(TableFilters, {
      props: {
        filters: defaultFilters,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    // Date inputs are always visible - check for the From and To labels
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
  });

  it('shows advanced filters when toggle is clicked', async () => {
    render(TableFilters, {
      props: {
        filters: defaultFilters,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    const toggleButton = screen.getByText(/Show Advanced Filters/);
    await fireEvent.click(toggleButton);

    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Timers')).toBeInTheDocument();
    expect(screen.getByText('Targets')).toBeInTheDocument();
  });

  it('displays type filter options', async () => {
    render(TableFilters, {
      props: {
        filters: defaultFilters,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    const toggleButton = screen.getByText(/Show Advanced Filters/);
    await fireEvent.click(toggleButton);

    expect(screen.getByRole('button', { name: 'Normal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sick' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Holiday' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Business Trip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Child Sick' })).toBeInTheDocument();
  });

  it('displays timer filter options', async () => {
    render(TableFilters, {
      props: {
        filters: defaultFilters,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    const toggleButton = screen.getByText(/Show Advanced Filters/);
    await fireEvent.click(toggleButton);

    expect(screen.getByRole('button', { name: '💼 Work' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '📚 Study' })).toBeInTheDocument();
  });

  it('displays target filter options', async () => {
    render(TableFilters, {
      props: {
        filters: defaultFilters,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    const toggleButton = screen.getByText(/Show Advanced Filters/);
    await fireEvent.click(toggleButton);

    expect(screen.getByRole('button', { name: 'Full-time Job' })).toBeInTheDocument();
  });

  it('updates search text on input', async () => {
    let capturedFilters = { ...defaultFilters };
    
    render(TableFilters, {
      props: {
        get filters() { return capturedFilters; },
        set filters(v) { capturedFilters = v; },
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    const searchInput = screen.getByPlaceholderText(/Search notes, timers, targets/);
    await fireEvent.input(searchInput, { target: { value: 'test search' } });

    expect(capturedFilters.searchText).toBe('test search');
  });

  it('toggles type filter on click', async () => {
    let capturedFilters = { ...defaultFilters };
    
    render(TableFilters, {
      props: {
        get filters() { return capturedFilters; },
        set filters(v) { capturedFilters = v; },
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    // Show advanced filters
    const toggleButton = screen.getByText(/Show Advanced Filters/);
    await fireEvent.click(toggleButton);

    // Click on Sick type
    const sickButton = screen.getByRole('button', { name: 'Sick' });
    await fireEvent.click(sickButton);

    expect(capturedFilters.types).toContain('sick');

    // Click again to deselect
    await fireEvent.click(sickButton);
    expect(capturedFilters.types).not.toContain('sick');
  });

  it('toggles timer filter on click', async () => {
    let capturedFilters = { ...defaultFilters };
    
    render(TableFilters, {
      props: {
        get filters() { return capturedFilters; },
        set filters(v) { capturedFilters = v; },
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    // Show advanced filters
    const toggleButton = screen.getByText(/Show Advanced Filters/);
    await fireEvent.click(toggleButton);

    // Click on Work timer
    const workButton = screen.getByRole('button', { name: '💼 Work' });
    await fireEvent.click(workButton);

    expect(capturedFilters.timerIds).toContain('timer-1');
  });

  it('shows reset button when filters are active', async () => {
    const activeFilters: FilterState = {
      ...defaultFilters,
      searchText: 'test',
    };

    render(TableFilters, {
      props: {
        filters: activeFilters,
        timers: mockTimers,
        targets: mockTargets,
      }
    });

    expect(screen.getByText('Reset Filters')).toBeInTheDocument();
  });

  it('allows resetting filters via reset button', async () => {
    const onReset = vi.fn();
    const activeFilters: FilterState = {
      ...defaultFilters,
      searchText: 'test',
    };

    render(TableFilters, {
      props: {
        filters: activeFilters,
        timers: mockTimers,
        targets: mockTargets,
        onReset,
      }
    });

    const resetButton = screen.getByText('Reset Filters');
    await fireEvent.click(resetButton);

    expect(onReset).toHaveBeenCalled();
  });
});
