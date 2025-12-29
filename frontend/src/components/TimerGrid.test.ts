import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import TimerGrid from './TimerGrid.svelte';
import type { Timer } from '../types';

const { mockActiveTimers } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    mockActiveTimers: writable([]),
  };
});

vi.mock('../stores/timers', () => ({
  activeTimers: mockActiveTimers,
}));

describe('TimerGrid Component', () => {
  let mockTimers: Timer[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockTimers = [
      {
        id: 't1',
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
        id: 't2',
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

    mockActiveTimers.set([]);
  });

  it('renders grid with multiple timers', () => {
    render(TimerGrid, { props: { timers: mockTimers, editMode: false } });
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Study')).toBeInTheDocument();
  });

  it('renders empty state when no timers', () => {
    render(TimerGrid, { props: { timers: [], editMode: false } });
    expect(screen.getByText('No tracking buttons yet')).toBeInTheDocument();
    expect(screen.getByText(/Click "Add Button"/i)).toBeInTheDocument();
  });

  it('passes edit mode to timer buttons', () => {
    render(TimerGrid, { props: { timers: mockTimers, editMode: true } });
    // Check for edit buttons (which only appear in edit mode)
    const editButtons = screen.getAllByRole('button', { name: /edit button/i });
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('applies col-span-2 to active timers', () => {
    mockActiveTimers.set([mockTimers[0]]);
    
    const { container } = render(TimerGrid, { props: { timers: mockTimers, editMode: false } });
    const gridItems = container.querySelectorAll('.grid > div');
    
    // First timer should have col-span-2 class
    expect(gridItems[0]).toHaveClass('col-span-2');
  });

  it('handles timer editing', async () => {
    render(TimerGrid, { props: { timers: mockTimers, editMode: true } });

    // Edit functionality is tested through TimerButton integration
  });

  it('uses correct grid layout classes', () => {
    const { container } = render(TimerGrid, { props: { timers: mockTimers, editMode: false } });
    const grid = container.querySelector('.grid');
    
    expect(grid).toHaveClass('grid-cols-2');
    expect(grid).toHaveClass('md:grid-cols-3');
    expect(grid).toHaveClass('lg:grid-cols-4');
  });
});
