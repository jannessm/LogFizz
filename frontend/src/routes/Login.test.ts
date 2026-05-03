import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import Login from './Login.svelte';

// Mock the stores
vi.mock('../stores/auth', () => ({
  authStore: {
    subscribe: vi.fn(),
    requestMagicLink: vi.fn().mockResolvedValue({ message: 'Magic link sent' }),
    register: vi.fn().mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Test' }),
  },
}));

// Mock navigation
vi.mock('../lib/navigation', () => ({
  navigate: vi.fn(),
}));

// Mock HCaptcha component
vi.mock('../components/HCaptcha.svelte', () => ({
  default: vi.fn(),
}));

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form by default with email only', () => {
    render(Login);
    expect(screen.getByText(/Login to LogFizz/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    // No password field in login mode
    expect(screen.queryByLabelText(/Password/i)).not.toBeInTheDocument();
  });

  it('shows register form when toggle is clicked', async () => {
    render(Login);
    const toggleButton = screen.getByRole('button', { name: /^Register$/i });
    await fireEvent.click(toggleButton);
    expect(screen.getByText(/Register to LogFizz/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    // No password field - registration uses magic link, not a password
    expect(screen.queryByLabelText(/Password/i)).not.toBeInTheDocument();
  });

  it('validates email input', () => {
    render(Login);
    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
    expect(emailInput.type).toBe('email');
    expect(emailInput.required).toBe(true);
  });

  it('shows a plain Login button without magic link terminology', () => {
    render(Login);
    expect(screen.getByRole('button', { name: /^Login$/i })).toBeInTheDocument();
    expect(screen.queryByText(/magic link/i)).not.toBeInTheDocument();
  });

  it('shows check-email page after registration instead of staying on the form', async () => {
    render(Login);
    // Switch to register mode
    await fireEvent.click(screen.getByRole('button', { name: /^Register$/i }));

    // Fill in the form
    await fireEvent.input(screen.getByLabelText(/Name/i), { target: { value: 'Test User' } });
    await fireEvent.input(screen.getByLabelText(/Email/i), { target: { value: 'test@example.com' } });

    // Submit
    await fireEvent.submit(document.querySelector('form')!);

    // The form should be replaced by the envelope "check your email" page
    await waitFor(() => {
      expect(screen.getByText(/back to login/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Name/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Email/i)).not.toBeInTheDocument();
    });
  });

  it('has max width of 500px on form container', () => {
    const { container } = render(Login);
    const formContainer = container.querySelector('[style*="max-width: 500px"]');
    expect(formContainer).toBeInTheDocument();
  });
});
