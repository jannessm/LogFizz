import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import Login from './Login.svelte';

// Mock the stores
vi.mock('../stores/auth', () => ({
  authStore: {
    subscribe: vi.fn(),
    login: vi.fn().mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Test' }),
    register: vi.fn().mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Test' }),
  },
}));

// Mock navigation
vi.mock('../lib/navigation', () => ({
  navigate: vi.fn(),
}));

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form by default', () => {
    render(Login);
    expect(screen.getByText(/Login to TapShift/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });

  it('shows register form when toggle is clicked', async () => {
    render(Login);
    const toggleButton = screen.getByText(/Don't have an account\? Register/i);
    await fireEvent.click(toggleButton);
    expect(screen.getByText(/Register to TapShift/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
  });

  it('validates email input', () => {
    render(Login);
    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
    expect(emailInput.type).toBe('email');
    expect(emailInput.required).toBe(true);
  });

  it('does not validate password length in login mode', () => {
    render(Login);
    const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    expect(passwordInput.hasAttribute('minlength')).toBe(false);
  });

  it('validates password length in register mode', async () => {
    render(Login);
    const toggleButton = screen.getByText(/Don't have an account\? Register/i);
    await fireEvent.click(toggleButton);
    const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    expect(passwordInput.getAttribute('minlength')).toBe('8');
  });

  it('has max width of 500px on form container', () => {
    const { container } = render(Login);
    const formContainer = container.querySelector('[style*="max-width: 500px"]');
    expect(formContainer).toBeInTheDocument();
  });
});
