import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import BarChart from './BarChart.svelte';
import dayjs from 'dayjs';

// Mock Chart.js
const { MockChart } = vi.hoisted(() => {
  class MockChart {
    constructor() {
      this.destroy = vi.fn();
      this.update = vi.fn();
    }
    static register = vi.fn();
  }
  
  return { MockChart };
});

vi.mock('chart.js', () => ({
  Chart: MockChart,
  BarController: vi.fn(),
  BarElement: vi.fn(),
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn(),
}));

vi.mock('../../lib/chart_utils', () => ({
  numberToHoursMinutes: (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  },
}));

describe('BarChart Component', () => {
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
        start_timestamp: '2024-01-15 09:00:00',
        end_timestamp: '2024-01-15 17:00:00',
        duration_minutes: 480,
      },
      {
        id: 'l2',
        timer_id: 'b2',
        start_timestamp: '2024-01-15 18:00:00',
        end_timestamp: '2024-01-15 20:00:00',
        duration_minutes: 120,
      },
    ];
  });

  it('renders canvas element', () => {
    const { container } = render(BarChart, {
      props: {
        buttons: mockButtons,
        currentMonth,
        timeLogs: mockTimeLogs,
      },
    });

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('renders with empty data', () => {
    const { container } = render(BarChart, {
      props: {
        buttons: [],
        currentMonth,
        timeLogs: [],
      },
    });

    expect(container).toBeInTheDocument();
  });
});
