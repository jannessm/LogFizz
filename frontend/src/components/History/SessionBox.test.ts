import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SessionBox from './SessionBox.svelte';
import dayjs from '../../../../lib/utils/dayjs.js';

vi.mock('../../../../lib/utils/timeFormat.js', () => ({
  formatMinutesCompact: (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  },
}));

describe('SessionBox Component', () => {
  let mockButton: any;
  let mockSession: any;
  let timelineStart: dayjs.Dayjs;
  let timelineEnd: dayjs.Dayjs;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockButton = {
      id: 'b1',
      name: 'Work',
      emoji: '💼',
      color: '#3B82F6',
    };

    const startTime = dayjs('2024-01-15 09:00:00');
    const endTime = dayjs('2024-01-15 17:00:00');

    mockSession = {
      id: 's1',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: 480, // 8 hours in minutes
    };

    timelineStart = dayjs('2024-01-15 08:00:00');
    timelineEnd = dayjs('2024-01-15 18:00:00');
  });

  it('renders session with button name and emoji', () => {
    render(SessionBox, {
      props: {
        session: mockSession,
        button: mockButton,
        timelineStart,
        timelineEnd,
      },
    });

    expect(screen.getByText(/Work/)).toBeInTheDocument();
    expect(screen.getByText('💼')).toBeInTheDocument();
  });

  it('displays session duration', () => {
    render(SessionBox, {
      props: {
        session: mockSession,
        button: mockButton,
        timelineStart,
        timelineEnd,
      },
    });

    expect(screen.getByText(/8h 0m/)).toBeInTheDocument();
  });

  it('displays start and end times', () => {
    render(SessionBox, {
      props: {
        session: mockSession,
        button: mockButton,
        timelineStart,
        timelineEnd,
      },
    });

    expect(screen.getByText(/09:00/)).toBeInTheDocument();
    expect(screen.getByText(/17:00/)).toBeInTheDocument();
  });

  it('shows "Running" for active session without end time', () => {
    const activeSession = {
      ...mockSession,
      endTime: null,
    };

    render(SessionBox, {
      props: {
        session: activeSession,
        button: mockButton,
        timelineStart,
        timelineEnd,
      },
    });

    expect(screen.getByText(/Running/)).toBeInTheDocument();
  });

  it('calls onEdit when clicked', async () => {
    const onEdit = vi.fn();
    
    const { container } = render(SessionBox, {
      props: {
        session: mockSession,
        button: mockButton,
        timelineStart,
        timelineEnd,
        onEdit,
      },
    });

    const box = container.querySelector('[role="button"]')!;
    await fireEvent.click(box);

    expect(onEdit).toHaveBeenCalledWith(mockSession);
  });

  it('calls onEdit when Enter key pressed', async () => {
    const onEdit = vi.fn();
    
    const { container } = render(SessionBox, {
      props: {
        session: mockSession,
        button: mockButton,
        timelineStart,
        timelineEnd,
        onEdit,
      },
    });

    const box = container.querySelector('[role="button"]')!;
    await fireEvent.keyDown(box, { key: 'Enter' });

    expect(onEdit).toHaveBeenCalledWith(mockSession);
  });

  it('shows edit button on hover', () => {
    render(SessionBox, {
      props: {
        session: mockSession,
        button: mockButton,
        timelineStart,
        timelineEnd,
      },
    });

    const editButton = screen.getByRole('button', { name: /edit entry/i });
    expect(editButton).toBeInTheDocument();
  });

  it('applies custom color from button', () => {
    const { container } = render(SessionBox, {
      props: {
        session: mockSession,
        button: mockButton,
        timelineStart,
        timelineEnd,
      },
    });

    const box = container.querySelector('[role="button"]');
    expect(box).toHaveStyle({ backgroundColor: '#3B82F6' });
  });

  it('handles indentation level', () => {
    const { container } = render(SessionBox, {
      props: {
        session: mockSession,
        button: mockButton,
        timelineStart,
        timelineEnd,
        indentLevel: 2,
      },
    });

    const box = container.querySelector('[role="button"]');
    // Check if left style is applied (2 * 60px = 120px)
    expect(box?.getAttribute('style')).toContain('left: 120px');
  });

  it('is keyboard accessible with tabindex', () => {
    const { container } = render(SessionBox, {
      props: {
        session: mockSession,
        button: mockButton,
        timelineStart,
        timelineEnd,
      },
    });

    const box = container.querySelector('[role="button"]');
    expect(box).toHaveAttribute('tabindex', '0');
  });
});
