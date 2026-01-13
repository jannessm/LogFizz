import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TimerForm from './TimerForm.svelte';

// Mock the stores
vi.mock('../../stores/timers', () => ({
  timersStore: {
    subscribe: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: '1', name: 'Test Timer' }),
    update: vi.fn().mockResolvedValue({ id: '1', name: 'Updated Timer' }),
  },
}));

describe('TimerForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create timer form', () => {
    render(TimerForm, { props: { timer: null } });
    expect(screen.getByText(/Add Timer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Button Name/i)).toBeInTheDocument();
  });

  it('renders edit timer form with existing data', () => {
    const mockTimer = {
      id: '1',
      user_id: '1',
      name: 'Work',
      emoji: '💼',
      color: '#3B82F6',
      auto_subtract_breaks: true,
      archived: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    render(TimerForm, { props: { timer: mockTimer } });
    expect(screen.getByText(/Edit Timer/i)).toBeInTheDocument();
  });

  it('validates required name field', () => {
    render(TimerForm, { props: { timer: null } });
    const nameInput = screen.getByLabelText(/Button Name/i) as HTMLInputElement;
    expect(nameInput.required).toBe(true);
  });

  it('shows color picker', () => {
    render(TimerForm, { props: { timer: null } });
    const colorPicker = screen.getByLabelText('Color');
    expect(colorPicker).toBeInTheDocument();
    expect(colorPicker.getAttribute('type')).toBe('color');
  });

  it('has max width class on modal', () => {
    const { container } = render(TimerForm, { props: { timer: null } });
    const modal = container.querySelector('.max-w-lg');
    expect(modal).toBeInTheDocument();
  });

  it('renders modal backdrop with close functionality', async () => {
    render(TimerForm, { props: { timer: null } });
    // Check for the close button with proper aria-label
    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();
  });

  it('renders dialog with proper ARIA attributes', () => {
    render(TimerForm, { props: { timer: null } });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
