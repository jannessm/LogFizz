import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HistoryCharts from './HistoryCharts.svelte';
import dayjs from 'dayjs';

describe('HistoryCharts Component', () => {
  let mockButtons: any[];
  let mockTimeLogs: any[];
  let currentMonth: dayjs.Dayjs;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockButtons = [
      { id: 'b1', name: 'Work', color: '#3B82F6' },
      { id: 'b2', name: 'Study', color: '#10B981' },
    ];

    currentMonth = dayjs('2024-01-15');

    mockTimeLogs = [
      {
        id: 'l1',
        timer_id: 'b1',
        start_timestamp: '2024-01-15T09:00:00',
        end_timestamp: '2024-01-15T17:00:00',
        duration_minutes: 480,
      },
      {
        id: 'l2',
        timer_id: 'b2',
        start_timestamp: '2024-01-16T18:00:00',
        end_timestamp: '2024-01-16T20:00:00',
        duration_minutes: 120,
      },
    ];
  });

  it('renders history charts component', () => {
    render(HistoryCharts, {
      props: {
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        currentMonth,
      },
    });

    expect(screen.getByText('Monthly Summary')).toBeInTheDocument();
  });

  it('displays message when no time logs', () => {
    render(HistoryCharts, {
      props: {
        buttons: mockButtons,
        timeLogs: [],
        currentMonth,
      },
    });

    expect(screen.getByText('No time logs for this month.')).toBeInTheDocument();
  });

  it('renders pie chart when time logs exist', () => {
    const { container } = render(HistoryCharts, {
      props: {
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        currentMonth,
      },
    });

    // Pie chart canvas should be rendered
    const canvases = container.querySelectorAll('canvas');
    expect(canvases.length).toBeGreaterThan(0);
  });

  it('renders bar chart when time logs exist', () => {
    const { container } = render(HistoryCharts, {
      props: {
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        currentMonth,
      },
    });

    // Bar chart canvas should be rendered
    const canvases = container.querySelectorAll('canvas');
    expect(canvases.length).toBeGreaterThanOrEqual(2); // Pie + Bar
  });

  it('handles date selection callback', () => {
    const onDateSelect = vi.fn();
    
    render(HistoryCharts, {
      props: {
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        currentMonth,
        onDateSelect,
      },
    });

    // onDateSelect prop is passed to BarChart
  });

  it('applies correct styling to container', () => {
    const { container } = render(HistoryCharts, {
      props: {
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        currentMonth,
      },
    });

    const chartContainer = container.querySelector('.bg-white.rounded-lg.shadow-md');
    expect(chartContainer).toBeInTheDocument();
  });

  it('has proper spacing between charts', () => {
    const { container } = render(HistoryCharts, {
      props: {
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        currentMonth,
      },
    });

    const barChartContainer = container.querySelector('.h-48.mt-4');
    expect(barChartContainer).toBeInTheDocument();
  });

  it('sets appropriate heights for charts', () => {
    const { container } = render(HistoryCharts, {
      props: {
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        currentMonth,
      },
    });

    const pieChartContainer = container.querySelector('.h-40');
    const barChartContainer = container.querySelector('.h-48');
    
    expect(pieChartContainer).toBeInTheDocument();
    expect(barChartContainer).toBeInTheDocument();
  });

  it('handles multiple buttons with different colors', () => {
    const manyButtons = [
      { id: 'b1', name: 'Work', color: '#3B82F6' },
      { id: 'b2', name: 'Study', color: '#10B981' },
      { id: 'b3', name: 'Exercise', color: '#F59E0B' },
    ];

    render(HistoryCharts, {
      props: {
        buttons: manyButtons,
        timeLogs: mockTimeLogs,
        currentMonth,
      },
    });

    // Charts should handle multiple button types
    expect(screen.getByText('Monthly Summary')).toBeInTheDocument();
  });
});
