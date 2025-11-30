import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ResetPassword from './ResetPassword.svelte';

// Mock the API
vi.mock('../services/api', () => ({
  authApi: {
    resetPassword: vi.fn().mockResolvedValue({ 
      message: 'Password has been reset successfully' 
    }),
  },
}));

// Mock svelte-routing
vi.mock('../lib/navigation', () => ({
  navigate: vi.fn(),
}));

describe('ResetPassword Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL search params with token and email
    delete (window as any).location;
    (window as any).location = { search: '?token=test-token-123&email=test@example.com' };
  });

  it('renders reset password form', () => {
    render(ResetPassword);
    expect(screen.getByRole('heading', { name: /Reset Password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
  });

  it('has max width of 500px on form container', () => {
    const { container } = render(ResetPassword);
    const formContainer = container.querySelector('[style*="max-width: 500px"]');
    expect(formContainer).toBeInTheDocument();
  });

  it('validates password fields', () => {
    render(ResetPassword);
    const newPasswordInput = screen.getByLabelText(/New Password/i) as HTMLInputElement;
    const confirmPasswordInput = screen.getByLabelText(/Confirm Password/i) as HTMLInputElement;
    
    expect(newPasswordInput.type).toBe('password');
    expect(newPasswordInput.required).toBe(true);
    expect(newPasswordInput.minLength).toBe(8);
    
    expect(confirmPasswordInput.type).toBe('password');
    expect(confirmPasswordInput.required).toBe(true);
  });

  it('shows password requirement text', () => {
    render(ResetPassword);
    expect(screen.getByText(/At least 8 characters/i)).toBeInTheDocument();
  });

  it('has back to login link', () => {
    render(ResetPassword);
    expect(screen.getByText(/Back to Login/i)).toBeInTheDocument();
  });

  it('shows error when no token in URL', () => {
    (window as any).location = { search: '' };
    render(ResetPassword);
    
    expect(screen.getByText(/Invalid reset link/i)).toBeInTheDocument();
  });

  it('works with token only (no email) for backward compatibility', () => {
    (window as any).location = { search: '?token=test-token-123' };
    render(ResetPassword);
    
    // Should render the form, not show an error
    expect(screen.getByRole('heading', { name: /Reset Password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
  });
});
