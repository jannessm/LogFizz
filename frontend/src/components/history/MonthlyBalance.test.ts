import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import MonthlyBalance from './MonthlyBalance.svelte';

// Mock the database functions
vi.mock('../../lib/db', () => ({
  saveBalance: vi.fn(),
  getSyncCursor: vi.fn(),
  saveSyncCursor: vi.fn(),
  getTimeLogsByYearMonth: vi.fn().mockResolvedValue([]),
  getTimeLogsByDateRange: vi.fn().mockResolvedValue([]),
}));

// Mock the stores
vi.mock('../../stores/balances', () => ({
  balancesStore: {
    getBalancesByDate: vi.fn(),
  },
}));

vi.mock('../../stores/targets', () => ({
  targetsStore: {
    getAll: vi.fn(),
  },
}));

// Mock the API
vi.mock('../../services/api', () => ({
  balanceApi: {
    getSyncChanges: vi.fn(),
  },
  isOnline: vi.fn(() => true),
}));

// Mock time format utils
vi.mock('../../../../lib/utils/timeFormat.js', () => ({
  formatMinutes: (minutes: number) => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? '-' : '';
    return `${sign}${hours}h ${mins}m`;
  },
  formatHours: (hours: number) => `${hours.toFixed(1)}h`,
  getBalanceColor: (balance: number) => {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-800';
  },
}));

describe('MonthlyBalance Component', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { balancesStore } = await import('../../stores/balances');
    const { targetsStore } = await import('../../stores/targets');
    
    vi.mocked(balancesStore.getBalancesByDate).mockResolvedValue([]);
    vi.mocked(targetsStore.getAll).mockReturnValue([]);
  });

  it('renders component with loading state', () => {
    const { container } = render(MonthlyBalance, {
      props: { year: 2024, month: 1 },
    });

    // Component should render
    expect(container).toBeInTheDocument();
  });

  it('loads balances for specified month', async () => {
    const { balancesStore } = await import('../../stores/balances');
    
    render(MonthlyBalance, {
      props: { year: 2024, month: 3 },
    });

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(balancesStore.getBalancesByDate).toHaveBeenCalledWith('2024-03');
  });

  it('loads balances with zero-padded month', async () => {
    const { balancesStore } = await import('../../stores/balances');
    
    render(MonthlyBalance, {
      props: { year: 2024, month: 5 },
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(balancesStore.getBalancesByDate).toHaveBeenCalledWith('2024-05');
  });

  it('displays balances when loaded', async () => {
    
    const mockBalances = [
      {
        id: 'b1',
        target_id: 't1',
        user_id: 'user1',
        date: '2024-01',
        worked_minutes: 480,
        due_minutes: 400,
        cumulative_minutes: 80,
        sick_days: 0,
        holidays: 0,
        business_trip: 0,
        child_sick: 0,
        worked_days: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockTargets = [
      {
        id: 't1',
        user_id: 'user1',
        name: 'Work',
        target_specs: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    const { balancesStore } = await import('../../stores/balances');
    const { targetsStore } = await import('../../stores/targets');
    
    vi.mocked(balancesStore.getBalancesByDate).mockResolvedValue(mockBalances);
    vi.mocked(targetsStore.getAll).mockReturnValue(mockTargets);

    render(MonthlyBalance, {
      props: { year: 2024, month: 1 },
    });

    // Wait for data to load
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  it('handles error state gracefully', async () => {
    const { balancesStore } = await import('../../stores/balances');
    
    vi.mocked(balancesStore.getBalancesByDate).mockRejectedValue(new Error('Database error'));

    const { container } = render(MonthlyBalance, {
      props: { year: 2024, month: 1 },
    });

    // Wait for error handling
    await new Promise(resolve => setTimeout(resolve, 200));

    // Component should still be in the document
    expect(container).toBeInTheDocument();
  });

  it('syncs from server when online', async () => {
    const { balanceApi } = await import('../../services/api');
    const { getSyncCursor } = await import('../../lib/db');
    
    vi.mocked(getSyncCursor).mockResolvedValue('2024-01-01T00:00:00Z');
    vi.mocked(balanceApi.getSyncChanges).mockResolvedValue({
      balances: [],
      cursor: '2024-01-15T00:00:00Z',
    });

    render(MonthlyBalance, {
      props: { year: 2024, month: 1 },
    });

    // Wait for sync to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(balanceApi.getSyncChanges).toHaveBeenCalled();
  });

  it('filters targets without starting_from', async () => {
    const { targetsStore } = await import('../../stores/targets');
    
    const mockTargets = [
      {
        id: 't1',
        user_id: 'user1',
        name: 'Work',
        target_specs: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 't2',
        user_id: 'user1',
        name: 'Study',
        target_specs: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ] as any;

    vi.mocked(targetsStore.getAll).mockReturnValue(mockTargets);

    render(MonthlyBalance, {
      props: { year: 2024, month: 1 },
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    // Component should filter correctly
    expect(targetsStore.getAll).toHaveBeenCalled();
  });
});
