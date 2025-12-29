import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DailyBalance from './DailyBalance.svelte';

const { mockBalances, mockTargets, mockLiveBalanceTick } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    mockBalances: writable([]),
    mockTargets: writable([]),
    mockLiveBalanceTick: writable(0),
  };
});

vi.mock('../stores/balances', () => ({
  dailyBalances: mockBalances,
}));

vi.mock('../stores/targets', () => ({
  todayTargets: mockTargets,
}));

vi.mock('../stores/live-balance', () => ({
  startBalanceUpdates: vi.fn(),
  stopBalanceUpdates: vi.fn(),
  liveBalanceTick: mockLiveBalanceTick,
}));

vi.mock('../../../lib/utils/timeFormat.js', () => ({
  formatMinutes: (minutes: number) => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? '-' : '';
    return `${sign}${hours}h ${mins}m`;
  },
}));

vi.mock('../../../lib/utils/dayjs.js', () => ({
  default: () => ({
    format: () => '2024-01-15',
  }),
}));

describe('DailyBalance Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBalances.set([]);
    mockTargets.set([]);
    mockLiveBalanceTick.set(0);
  });

  it('renders nothing when no balances exist', () => {
    const { container } = render(DailyBalance);
    expect(container.querySelector('.bg-white')).not.toBeInTheDocument();
  });

  it('displays balance for today', () => {
    mockTargets.set([
      { id: 't1', name: 'Work', target_specs: [] }
    ]);
    
    mockBalances.set([
      {
        id: 'b1',
        target_id: 't1',
        date: '2024-01-15',
        worked_minutes: 480,
        due_minutes: 400,
        cumulative_minutes: 80,
      }
    ]);

    render(DailyBalance);
    expect(screen.getByText("Today's Balance")).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('shows positive balance in green', () => {
    mockTargets.set([
      { id: 't1', name: 'Work', target_specs: [] }
    ]);
    
    mockBalances.set([
      {
        id: 'b1',
        target_id: 't1',
        date: '2024-01-15',
        worked_minutes: 500,
        due_minutes: 400,
        cumulative_minutes: 100,
      }
    ]);

    const { container } = render(DailyBalance);
    const balanceElement = container.querySelector('.text-green-600');
    expect(balanceElement).toBeInTheDocument();
  });

  it('shows negative balance in red', () => {
    mockTargets.set([
      { id: 't1', name: 'Work', target_specs: [] }
    ]);
    
    mockBalances.set([
      {
        id: 'b1',
        target_id: 't1',
        date: '2024-01-15',
        worked_minutes: 300,
        due_minutes: 400,
        cumulative_minutes: -100,
      }
    ]);

    const { container } = render(DailyBalance);
    const balanceElement = container.querySelector('.text-red-600');
    expect(balanceElement).toBeInTheDocument();
  });

  it('shows zero balance in gray', () => {
    mockTargets.set([
      { id: 't1', name: 'Work', target_specs: [] }
    ]);
    
    mockBalances.set([
      {
        id: 'b1',
        target_id: 't1',
        date: '2024-01-15',
        worked_minutes: 400,
        due_minutes: 400,
        cumulative_minutes: 0,
      }
    ]);

    const { container } = render(DailyBalance);
    const balanceElement = container.querySelector('.text-gray-800');
    expect(balanceElement).toBeInTheDocument();
  });

  it('displays worked and due minutes', () => {
    mockTargets.set([
      { id: 't1', name: 'Work', target_specs: [] }
    ]);
    
    mockBalances.set([
      {
        id: 'b1',
        target_id: 't1',
        date: '2024-01-15',
        worked_minutes: 480,
        due_minutes: 400,
        cumulative_minutes: 80,
      }
    ]);

    render(DailyBalance);
    expect(screen.getByText('Worked:')).toBeInTheDocument();
    expect(screen.getByText('Due:')).toBeInTheDocument();
  });

  it('shows holiday exclusion note when applicable', () => {
    mockTargets.set([
      { 
        id: 't1', 
        name: 'Work', 
        target_specs: [{ exclude_holidays: true }] 
      }
    ]);
    
    mockBalances.set([
      {
        id: 'b1',
        target_id: 't1',
        date: '2024-01-15',
        worked_minutes: 480,
        due_minutes: 400,
        cumulative_minutes: 80,
      }
    ]);

    render(DailyBalance);
    expect(screen.getByText('(excluding public holidays)')).toBeInTheDocument();
  });

  it('starts balance updates on mount', async () => {
    const { startBalanceUpdates } = await import('../stores/live-balance');
    render(DailyBalance);
    expect(startBalanceUpdates).toHaveBeenCalled();
  });

  it('stops balance updates on destroy', async () => {
    const { stopBalanceUpdates } = await import('../stores/live-balance');
    const { unmount } = render(DailyBalance);
    unmount();
    expect(stopBalanceUpdates).toHaveBeenCalled();
  });

  it('filters and displays only today balances', () => {
    mockTargets.set([
      { id: 't1', name: 'Work', target_specs: [] },
      { id: 't2', name: 'Study', target_specs: [] }
    ]);
    
    mockBalances.set([
      {
        id: 'b1',
        target_id: 't1',
        date: '2024-01-15',
        worked_minutes: 480,
        due_minutes: 400,
        cumulative_minutes: 80,
      },
      {
        id: 'b2',
        target_id: 't2',
        date: '2024-01-14', // Yesterday
        worked_minutes: 300,
        due_minutes: 400,
        cumulative_minutes: -100,
      }
    ]);

    render(DailyBalance);
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.queryByText('Study')).not.toBeInTheDocument();
  });
});
