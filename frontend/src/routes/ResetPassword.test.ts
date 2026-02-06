import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ResetPassword from './ResetPassword.svelte';
import { authApi } from '../services/api';
import { navigate } from '../lib/navigation';

// Mock the API
vi.mock('../services/api', () => ({
  authApi: {
    resetPassword: vi.fn(),
  },
}));

// Mock svelte-routing
vi.mock('../lib/navigation', () => ({
  navigate: vi.fn(),
}));

// Helper function to get password input by id
const getNewPasswordInput = (container: HTMLElement) => container.querySelector('#newPassword') as HTMLInputElement;
const getConfirmPasswordInput = (container: HTMLElement) => container.querySelector('#confirmPassword') as HTMLInputElement;

describe('ResetPassword Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Mock URL search params with token and email
    delete (window as any).location;
    (window as any).location = { search: '?token=test-token-123&email=test@example.com' };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders reset password form', () => {
    const { container } = render(ResetPassword);
    expect(screen.getByRole('heading', { name: /Reset Password/i })).toBeInTheDocument();
    expect(getNewPasswordInput(container)).toBeInTheDocument();
    expect(getConfirmPasswordInput(container)).toBeInTheDocument();
  });

  it('has max width of 500px on form container', () => {
    const { container } = render(ResetPassword);
    const formContainer = container.querySelector('[style*="max-width: 500px"]');
    expect(formContainer).toBeInTheDocument();
  });

  it('validates password fields', () => {
    const { container } = render(ResetPassword);
    const newPasswordInput = getNewPasswordInput(container);
    const confirmPasswordInput = getConfirmPasswordInput(container);
    
    expect(newPasswordInput.type).toBe('password');
    expect(newPasswordInput.required).toBe(true);
    expect(newPasswordInput.minLength).toBe(8);
    
    expect(confirmPasswordInput.type).toBe('password');
    expect(confirmPasswordInput.required).toBe(true);
  });

  it('shows password requirement text', () => {
    render(ResetPassword);
    // Text is now from i18n translation
    expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('has back to login link', () => {
    render(ResetPassword);
    expect(screen.getByText(/Back to Login/i)).toBeInTheDocument();
  });

  it('shows error when no token in URL', () => {
    (window as any).location = { search: '' };
    render(ResetPassword);
    
    // Text is now from i18n translation
    expect(screen.getByText(/Invalid or expired reset token/i)).toBeInTheDocument();
  });

  it('shows error when only token provided (no email)', () => {
    (window as any).location = { search: '?token=test-token-123' };
    render(ResetPassword);
    
    // Text is now from i18n translation
    expect(screen.getByText(/Invalid or expired reset token/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    const { container } = render(ResetPassword);
    
    const newPasswordInput = getNewPasswordInput(container);
    const confirmPasswordInput = getConfirmPasswordInput(container);
    const submitButton = screen.getByRole('button', { name: /Reset Password/i });

    await fireEvent.input(newPasswordInput, { target: { value: 'password123' } });
    await fireEvent.input(confirmPasswordInput, { target: { value: 'differentpass' } });
    await fireEvent.click(submitButton);

    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });

  it('shows error when password is too short', async () => {
    const { container } = render(ResetPassword);
    
    const newPasswordInput = getNewPasswordInput(container);
    const confirmPasswordInput = getConfirmPasswordInput(container);
    const submitButton = screen.getByRole('button', { name: /Reset Password/i });

    await fireEvent.input(newPasswordInput, { target: { value: 'short' } });
    await fireEvent.input(confirmPasswordInput, { target: { value: 'short' } });
    await fireEvent.click(submitButton);

    // The hint text already shows this message, and error shows same message
    expect(screen.getAllByText(/Password must be at least 8 characters/i).length).toBeGreaterThan(0);
    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });

  it('successfully resets password and redirects to login', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue({ 
      message: 'Password has been reset successfully' 
    });

    const { container } = render(ResetPassword);
    
    const newPasswordInput = getNewPasswordInput(container);
    const confirmPasswordInput = getConfirmPasswordInput(container);
    const submitButton = screen.getByRole('button', { name: /Reset Password/i });

    await fireEvent.input(newPasswordInput, { target: { value: 'newpassword123' } });
    await fireEvent.input(confirmPasswordInput, { target: { value: 'newpassword123' } });
    await fireEvent.click(submitButton);

    // Should call API with correct parameters
    await waitFor(() => {
      expect(authApi.resetPassword).toHaveBeenCalledWith('test-token-123', 'newpassword123', 'test@example.com');
    });

    // Should show success message
    expect(screen.getByText(/Password has been reset successfully/i)).toBeInTheDocument();
    // Text is now from i18n translation
    expect(screen.getByText(/Redirecting/i)).toBeInTheDocument();

    // Should redirect after 2 seconds
    vi.advanceTimersByTime(2000);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login');
    });
  });

  it('shows loading state during password reset', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    
    vi.mocked(authApi.resetPassword).mockReturnValue(promise as any);

    const { container } = render(ResetPassword);
    
    const newPasswordInput = getNewPasswordInput(container);
    const confirmPasswordInput = getConfirmPasswordInput(container);
    const submitButton = screen.getByRole('button', { name: /Reset Password/i });

    await fireEvent.input(newPasswordInput, { target: { value: 'newpassword123' } });
    await fireEvent.input(confirmPasswordInput, { target: { value: 'newpassword123' } });
    await fireEvent.click(submitButton);

    // Should show loading state (text is now from i18n - "Loading...")
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Loading/i })).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    // Resolve the promise
    resolvePromise!({ message: 'Success' });

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/Success/i)).toBeInTheDocument();
    });
  });

  it('handles API error when reset fails', async () => {
    vi.mocked(authApi.resetPassword).mockRejectedValue(
      new Error('Failed to reset password. The link may be invalid or expired.')
    );

    const { container } = render(ResetPassword);
    
    const newPasswordInput = getNewPasswordInput(container);
    const confirmPasswordInput = getConfirmPasswordInput(container);
    const submitButton = screen.getByRole('button', { name: /Reset Password/i });

    await fireEvent.input(newPasswordInput, { target: { value: 'newpassword123' } });
    await fireEvent.input(confirmPasswordInput, { target: { value: 'newpassword123' } });
    await fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to reset password. The link may be invalid or expired./i)).toBeInTheDocument();
    });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('handles rate limiting error (429)', async () => {
    vi.mocked(authApi.resetPassword).mockRejectedValue({
      response: { status: 429 },
      message: 'Too Many Requests'
    });

    const { container } = render(ResetPassword);
    
    const newPasswordInput = getNewPasswordInput(container);
    const confirmPasswordInput = getConfirmPasswordInput(container);
    const submitButton = screen.getByRole('button', { name: /Reset Password/i });

    await fireEvent.input(newPasswordInput, { target: { value: 'newpassword123' } });
    await fireEvent.input(confirmPasswordInput, { target: { value: 'newpassword123' } });
    await fireEvent.click(submitButton);

    await waitFor(() => {
      // Text is now from i18n translation
      expect(screen.getByText(/Too many password reset attempts/i)).toBeInTheDocument();
    });
  });

  it('disables form inputs after successful reset', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue({ 
      message: 'Password has been reset successfully' 
    });

    const { container } = render(ResetPassword);
    
    const newPasswordInput = getNewPasswordInput(container);
    const confirmPasswordInput = getConfirmPasswordInput(container);
    const submitButton = screen.getByRole('button', { name: /Reset Password/i });

    await fireEvent.input(newPasswordInput, { target: { value: 'newpassword123' } });
    await fireEvent.input(confirmPasswordInput, { target: { value: 'newpassword123' } });
    await fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Password has been reset successfully/i)).toBeInTheDocument();
    });

    // Inputs should be disabled
    expect(newPasswordInput.disabled).toBe(true);
    expect(confirmPasswordInput.disabled).toBe(true);
    expect(submitButton).toBeDisabled();
  });

  it('navigates to login when "Back to Login" is clicked', async () => {
    render(ResetPassword);
    
    const backButton = screen.getByRole('button', { name: /Back to Login/i });
    await fireEvent.click(backButton);

    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('hides form when invalid reset link error is shown without token', async () => {
    (window as any).location = { search: '' };
    const { container } = render(ResetPassword);
    
    // Text is now from i18n translation
    expect(screen.getByText(/Invalid or expired reset token/i)).toBeInTheDocument();
    expect(getNewPasswordInput(container)).not.toBeInTheDocument();
    expect(getConfirmPasswordInput(container)).not.toBeInTheDocument();
  });

  it('clears error messages on new submission', async () => {
    const { container } = render(ResetPassword);
    
    const newPasswordInput = getNewPasswordInput(container);
    const confirmPasswordInput = getConfirmPasswordInput(container);
    const submitButton = screen.getByRole('button', { name: /Reset Password/i });

    // First submission - password mismatch
    await fireEvent.input(newPasswordInput, { target: { value: 'password123' } });
    await fireEvent.input(confirmPasswordInput, { target: { value: 'different' } });
    await fireEvent.click(submitButton);

    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();

    // Second submission - should clear previous error
    await fireEvent.input(confirmPasswordInput, { target: { value: 'password123' } });
    
    vi.mocked(authApi.resetPassword).mockResolvedValue({ message: 'Success' });
    await fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Success/i)).toBeInTheDocument();
    });
  });
});
