import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ForgotPassword from './ForgotPassword.svelte';

// Mock the API
vi.mock('../services/api', () => ({
  authApi: {
    forgotPassword: vi.fn().mockResolvedValue({ 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    }),
  },
}));

// Mock svelte-routing
vi.mock('../lib/navigation', () => ({
  navigate: vi.fn(),
}));

describe('ForgotPassword Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders forgot password form', () => {
    render(ForgotPassword);
    expect(screen.getByText(/Forgot Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Reset Link/i })).toBeInTheDocument();
  });

  it('has max width of 500px on form container', () => {
    const { container } = render(ForgotPassword);
    const formContainer = container.querySelector('[style*="max-width: 500px"]');
    expect(formContainer).toBeInTheDocument();
  });

  it('shows instructions text', () => {
    render(ForgotPassword);
    expect(screen.getByText(/Enter your email address/i)).toBeInTheDocument();
  });

  it('validates email input', () => {
    render(ForgotPassword);
    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
    expect(emailInput.type).toBe('email');
    expect(emailInput.required).toBe(true);
  });

  it('has back to login link', () => {
    render(ForgotPassword);
    expect(screen.getByText(/Back to Login/i)).toBeInTheDocument();
  });

  it('shows success message after submission', async () => {
    render(ForgotPassword);
    
    const emailInput = screen.getByLabelText(/Email/i);
    const submitButton = screen.getByRole('button', { name: /Send Reset Link/i });

    await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    await fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password reset link has been sent/i)).toBeInTheDocument();
    });
  });
});
