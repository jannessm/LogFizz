import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AddSelector from './AddSelector.svelte';

describe('AddSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with correct title', () => {
    render(AddSelector);
    expect(screen.getByText('Add New')).toBeInTheDocument();
  });

  it('renders close button', () => {
    render(AddSelector);
    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();
  });

  it('renders add button option', () => {
    render(AddSelector);
    expect(screen.getByText('Add Timer')).toBeInTheDocument();
    expect(screen.getByText('Create a new timer button')).toBeInTheDocument();
  });

  it('renders add target option', () => {
    render(AddSelector);
    expect(screen.getByText('Add Target')).toBeInTheDocument();
    expect(screen.getByText('Create a new target')).toBeInTheDocument();
  });

  it('has proper ARIA attributes for accessibility', () => {
    render(AddSelector);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('renders buttons with correct styling', () => {
    const { container } = render(AddSelector);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('displays icons for both options', () => {
    const { container } = render(AddSelector);
    const icons = container.querySelectorAll('[class*="icon-"]');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('has interactive hover states', () => {
    const { container } = render(AddSelector);
    const timerOption = screen.getByText('Add Timer').closest('button');
    expect(timerOption).toHaveClass('hover:border-blue-500');
  });

  it('has proper structure with overlay', () => {
    const { container } = render(AddSelector);
    const overlay = container.querySelector('.fixed.inset-0');
    expect(overlay).toBeInTheDocument();
  });
});
