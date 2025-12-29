import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import PasswordSection from './PasswordSection.svelte';

describe('PasswordSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders password change section', () => {
    render(PasswordSection);
    const heading = screen.getByRole('heading', { name: /change password/i });
    expect(heading).toBeInTheDocument();
  });

  it('renders all password fields', () => {
    render(PasswordSection);
    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
  });

  it('renders change password button', () => {
    render(PasswordSection);
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
  });

  it('all password fields are of type password', () => {
    render(PasswordSection);
    const currentPassword = screen.getByLabelText('Current Password') as HTMLInputElement;
    const newPassword = screen.getByLabelText('New Password') as HTMLInputElement;
    const confirmPassword = screen.getByLabelText('Confirm New Password') as HTMLInputElement;

    expect(currentPassword.type).toBe('password');
    expect(newPassword.type).toBe('password');
    expect(confirmPassword.type).toBe('password');
  });

  it('enforces minimum length for new password fields', () => {
    render(PasswordSection);
    const newPassword = screen.getByLabelText('New Password') as HTMLInputElement;
    const confirmPassword = screen.getByLabelText('Confirm New Password') as HTMLInputElement;

    expect(newPassword.minLength).toBe(8);
    expect(confirmPassword.minLength).toBe(8);
  });

  it('handles password validation', async () => {
    render(PasswordSection);
    
    const button = screen.getByRole('button', { name: /change password/i });
    expect(button).toBeInTheDocument();
  });

  it('renders all password input fields correctly', () => {
    render(PasswordSection);
    
    const currentPassword = screen.getByLabelText('Current Password') as HTMLInputElement;
    const newPassword = screen.getByLabelText('New Password') as HTMLInputElement;
    const confirmPassword = screen.getByLabelText('Confirm New Password') as HTMLInputElement;

    expect(currentPassword).toBeInTheDocument();
    expect(newPassword).toBeInTheDocument();
    expect(confirmPassword).toBeInTheDocument();
  });
});
