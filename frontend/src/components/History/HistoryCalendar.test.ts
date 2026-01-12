import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HistoryCalendar from './HistoryCalendar.svelte';
import dayjs from 'dayjs';

// Mock the db module
vi.mock('../../lib/db', () => ({
  getSetting: vi.fn().mockResolvedValue('sunday'),
}));

describe('HistoryCalendar Component', () => {
  const mockButtons = [
    { id: '1', name: 'Work', color: '#3B82F6' },
    { id: '2', name: 'Break', color: '#10B981' },
  ];

  const mockTimeLogs = [
    { id: '1', button_id: '1', start_timestamp: '2024-01-15T10:00:00Z', end_timestamp: '2024-01-15T12:00:00Z' },
    { id: '2', button_id: '2', start_timestamp: '2024-01-15T14:00:00Z', end_timestamp: '2024-01-15T15:00:00Z' },
  ];

  const mockCurrentMonth = dayjs('2024-01-15');
  const mockSelectedDate = dayjs('2024-01-15');
  const mockOnSelectDate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders calendar with week numbers', async () => {
    render(HistoryCalendar, {
      props: {
        currentMonth: mockCurrentMonth,
        selectedDate: mockSelectedDate,
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        onSelectDate: mockOnSelectDate,
      },
    });

    // Wait for component to mount and load settings
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if calendar grid is rendered
    const calendar = screen.getByRole('button', { name: /15/i });
    expect(calendar).toBeInTheDocument();
  });

  it('displays Sunday as first day by default', async () => {
    const { getSetting } = await import('../../lib/db');
    (getSetting as any).mockResolvedValue('sunday');

    const { container } = render(HistoryCalendar, {
      props: {
        currentMonth: mockCurrentMonth,
        selectedDate: mockSelectedDate,
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        onSelectDate: mockOnSelectDate,
      },
    });

    // Wait for component to mount and load settings
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if day names are rendered with Sunday first
    const dayHeaders = container.querySelectorAll('.text-xs.font-semibold.text-gray-600');
    expect(dayHeaders.length).toBeGreaterThan(0);
    
    // The first day header should be Sun (after the empty week number column)
    const dayNames = Array.from(dayHeaders).map(el => el.textContent?.trim());
    expect(dayNames[0]).toBe('Sun');
  });

  it('displays Monday as first day when setting is monday', async () => {
    const { getSetting } = await import('../../lib/db');
    (getSetting as any).mockResolvedValue('monday');

    const { container, rerender } = render(HistoryCalendar, {
      props: {
        currentMonth: mockCurrentMonth,
        selectedDate: mockSelectedDate,
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        onSelectDate: mockOnSelectDate,
      },
    });

    // Wait for component to mount and load settings
    await new Promise(resolve => setTimeout(resolve, 100));

    // Force re-render to ensure setting is applied
    await rerender({
      currentMonth: mockCurrentMonth,
      selectedDate: mockSelectedDate,
      buttons: mockButtons,
      timeLogs: mockTimeLogs,
      onSelectDate: mockOnSelectDate,
    });

    // Check if day names are rendered with Monday first
    const dayHeaders = container.querySelectorAll('.text-xs.font-semibold.text-gray-600');
    expect(dayHeaders.length).toBeGreaterThan(0);
    
    // The first day header should be Mon (after the empty week number column)
    const dayNames = Array.from(dayHeaders).map(el => el.textContent?.trim());
    expect(dayNames[0]).toBe('Mon');
  });

  it('renders 42 days (6 weeks) in the calendar', async () => {
    const { container } = render(HistoryCalendar, {
      props: {
        currentMonth: mockCurrentMonth,
        selectedDate: mockSelectedDate,
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        onSelectDate: mockOnSelectDate,
      },
    });

    // Wait for component to mount
    await new Promise(resolve => setTimeout(resolve, 100));

    // Count all day buttons (should be 42 for 6 weeks)
    const dayButtons = container.querySelectorAll('button');
    expect(dayButtons.length).toBe(42);
  });

  it('shows activity dots for days with timelogs', async () => {
    const { container } = render(HistoryCalendar, {
      props: {
        currentMonth: mockCurrentMonth,
        selectedDate: mockSelectedDate,
        buttons: mockButtons,
        timeLogs: mockTimeLogs,
        onSelectDate: mockOnSelectDate,
      },
    });

    // Wait for component to mount
    await new Promise(resolve => setTimeout(resolve, 100));

    // Look for activity dots (small colored circles)
    const dots = container.querySelectorAll('.w-1.h-1.rounded-full');
    expect(dots.length).toBeGreaterThan(0);
  });
});
