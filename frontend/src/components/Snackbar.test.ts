import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import Snackbar from './Snackbar.svelte';

// Create a writable store for snackbar
const createSnackbarStore = () => {
  const { subscribe, set } = writable({ messages: [] });
  return {
    subscribe,
    set,
    show: vi.fn(),
    dismiss: vi.fn(),
  };
};

let mockSnackbarStore = createSnackbarStore();

vi.mock('../stores/snackbar', () => ({
  get snackbar() {
    return mockSnackbarStore;
  },
}));

describe('Snackbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSnackbarStore = createSnackbarStore();
  });

  it('renders without messages', () => {
    const { container } = render(Snackbar);
    const snackbarContainer = container.querySelector('.fixed.bottom-20');
    expect(snackbarContainer).toBeInTheDocument();
  });

  it('displays success message with correct styling', () => {
    mockSnackbarStore.set({
      messages: [{ id: '1', message: 'Success!', type: 'success' }]
    });

    const { container } = render(Snackbar);
    expect(container.textContent).toContain('Success!');
    const successEl = container.querySelector('.bg-green-600');
    expect(successEl).toBeInTheDocument();
  });

  it('displays error message with correct styling', () => {
    mockSnackbarStore.set({
      messages: [{ id: '2', message: 'Error occurred', type: 'error' }]
    });

    const { container } = render(Snackbar);
    expect(container.textContent).toContain('Error occurred');
    const errorEl = container.querySelector('.bg-red-600');
    expect(errorEl).toBeInTheDocument();
  });

  it('displays warning message with correct styling', () => {
    mockSnackbarStore.set({
      messages: [{ id: '3', message: 'Warning!', type: 'warning' }]
    });

    const { container } = render(Snackbar);
    expect(container.textContent).toContain('Warning!');
    const warningEl = container.querySelector('.bg-yellow-500');
    expect(warningEl).toBeInTheDocument();
  });

  it('displays info message with correct styling', () => {
    mockSnackbarStore.set({
      messages: [{ id: '4', message: 'Information', type: 'info' }]
    });

    const { container } = render(Snackbar);
    expect(container.textContent).toContain('Information');
    const infoEl = container.querySelector('.bg-blue-600');
    expect(infoEl).toBeInTheDocument();
  });

  it('renders close button for dismissal', () => {
    mockSnackbarStore.set({
      messages: [{ id: '5', message: 'Test message', type: 'info' }]
    });

    render(Snackbar);
    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    mockSnackbarStore.set({
      messages: [
        { 
          id: '6', 
          message: 'Action needed', 
          type: 'info',
          action: { label: 'Retry', callback: vi.fn() }
        }
      ]
    });

    render(Snackbar);
    const actionButton = screen.getByText('Retry');
    expect(actionButton).toBeInTheDocument();
  });

  it('displays multiple messages', () => {
    mockSnackbarStore.set({
      messages: [
        { id: '7', message: 'First message', type: 'success' },
        { id: '8', message: 'Second message', type: 'error' }
      ]
    });

    const { container } = render(Snackbar);
    expect(container.textContent).toContain('First message');
    expect(container.textContent).toContain('Second message');
  });
});
