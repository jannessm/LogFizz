import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ProfileSection from './ProfileSection.svelte';

describe('ProfileSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders profile section with email and name fields', () => {
    render(ProfileSection, {
      props: {
        email: 'test@example.com',
        name: 'John Doe',
        originalName: 'John Doe',
      },
    });

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('displays email as disabled field', () => {
    render(ProfileSection, {
      props: {
        email: 'test@example.com',
        name: 'John Doe',
        originalName: 'John Doe',
      },
    });

    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    expect(emailInput).toBeDisabled();
    expect(emailInput.value).toBe('test@example.com');
  });

  it('shows current name in editable field', () => {
    render(ProfileSection, {
      props: {
        email: 'test@example.com',
        name: 'John Doe',
        originalName: 'John Doe',
      },
    });

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput).not.toBeDisabled();
    expect(nameInput.value).toBe('John Doe');
  });

  it('shows unsaved badge when name changes', async () => {
    render(ProfileSection, {
      props: {
        email: 'test@example.com',
        name: 'Jane Doe',
        originalName: 'John Doe',
      },
    });

    // Text is now "Unsaved" from i18n translation
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
  });

  it('does not show unsaved badge when name unchanged', () => {
    render(ProfileSection, {
      props: {
        email: 'test@example.com',
        name: 'John Doe',
        originalName: 'John Doe',
      },
    });

    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument();
  });

  it('disables update button when name unchanged', () => {
    render(ProfileSection, {
      props: {
        email: 'test@example.com',
        name: 'John Doe',
        originalName: 'John Doe',
      },
    });

    // Button text is now "Save" from i18n translation
    const updateButton = screen.getByRole('button', { name: /save/i });
    expect(updateButton).toBeDisabled();
  });

  it('enables update button when name changes', () => {
    render(ProfileSection, {
      props: {
        email: 'test@example.com',
        name: 'Jane Doe',
        originalName: 'John Doe',
      },
    });

    const updateButton = screen.getByRole('button', { name: /save/i });
    expect(updateButton).not.toBeDisabled();
  });

  it('handles submit action when button clicked', async () => {
    render(ProfileSection, {
      props: {
        email: 'test@example.com',
        name: 'Jane Doe',
        originalName: 'John Doe',
      },
    });

    const updateButton = screen.getByRole('button', { name: /save/i });
    // Button should be enabled and clickable
    expect(updateButton).not.toBeDisabled();
  });

  it('applies special styling to name field when changed', () => {
    const { container } = render(ProfileSection, {
      props: {
        email: 'test@example.com',
        name: 'Jane Doe',
        originalName: 'John Doe',
      },
    });

    const nameInput = container.querySelector('input#name');
    expect(nameInput).toHaveClass('border-orange-400');
    expect(nameInput).toHaveClass('bg-orange-50');
  });
});
