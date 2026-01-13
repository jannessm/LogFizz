import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AlertMessage from './AlertMessage.svelte';

describe('AlertMessage Component', () => {
  beforeEach(() => {
    // Clear any mocks if needed
  });

  it('renders nothing when message is empty', () => {
    const { container } = render(AlertMessage, {
      props: { type: 'error', message: '' },
    });
    expect(container.querySelector('.mb-4')).not.toBeInTheDocument();
  });

  it('renders error message with correct styling', () => {
    render(AlertMessage, {
      props: { type: 'error', message: 'This is an error' },
    });
    expect(screen.getByText('This is an error')).toBeInTheDocument();
  });

  it('applies error styles when type is error', () => {
    const { container } = render(AlertMessage, {
      props: { type: 'error', message: 'Error message' },
    });
    const alert = container.querySelector('.bg-red-100');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('border-red-400');
    expect(alert).toHaveClass('text-red-700');
  });

  it('renders success message with correct styling', () => {
    render(AlertMessage, {
      props: { type: 'success', message: 'This is a success' },
    });
    expect(screen.getByText('This is a success')).toBeInTheDocument();
  });

  it('applies success styles when type is success', () => {
    const { container } = render(AlertMessage, {
      props: { type: 'success', message: 'Success message' },
    });
    const alert = container.querySelector('.bg-green-100');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('border-green-400');
    expect(alert).toHaveClass('text-green-700');
  });

  it('displays long messages correctly', () => {
    const longMessage = 'This is a very long message that should still be displayed correctly within the alert component without any issues';
    render(AlertMessage, {
      props: { type: 'error', message: longMessage },
    });
    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });

  it('has proper spacing classes', () => {
    const { container } = render(AlertMessage, {
      props: { type: 'success', message: 'Test message' },
    });
    const alert = container.querySelector('.mb-4.p-3');
    expect(alert).toBeInTheDocument();
  });

  it('has rounded corners', () => {
    const { container } = render(AlertMessage, {
      props: { type: 'error', message: 'Test' },
    });
    const alert = container.querySelector('.rounded');
    expect(alert).toBeInTheDocument();
  });
});
