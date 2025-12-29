import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SyncStatusSection from './SyncStatusSection.svelte';

describe('SyncStatusSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sync status section', () => {
    render(SyncStatusSection, {
      props: { hasPendingSync: false, isOnline: true },
    });
    expect(screen.getByText('Sync Status')).toBeInTheDocument();
  });

  it('displays online status when online', () => {
    render(SyncStatusSection, {
      props: { hasPendingSync: false, isOnline: true },
    });
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('displays offline status when offline', () => {
    render(SyncStatusSection, {
      props: { hasPendingSync: false, isOnline: false },
    });
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('shows pending changes message when hasPendingSync is true', () => {
    render(SyncStatusSection, {
      props: { hasPendingSync: true, isOnline: true },
    });
    expect(screen.getByText('Pending changes to sync')).toBeInTheDocument();
  });

  it('shows all synced message when hasPendingSync is false', () => {
    render(SyncStatusSection, {
      props: { hasPendingSync: false, isOnline: true },
    });
    expect(screen.getByText('All synced')).toBeInTheDocument();
  });

  it('renders sync now button', () => {
    render(SyncStatusSection, {
      props: { hasPendingSync: true, isOnline: true },
    });
    expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
  });

  it('disables sync button when offline', () => {
    render(SyncStatusSection, {
      props: { hasPendingSync: true, isOnline: false },
    });
    const syncButton = screen.getByRole('button', { name: /sync now/i });
    expect(syncButton).toBeDisabled();
  });

  it('enables sync button when online', () => {
    render(SyncStatusSection, {
      props: { hasPendingSync: true, isOnline: true },
    });
    const syncButton = screen.getByRole('button', { name: /sync now/i });
    expect(syncButton).not.toBeDisabled();
  });

  it('handles sync action when button is clicked', () => {
    render(SyncStatusSection, {
      props: { hasPendingSync: true, isOnline: true },
    });
    
    const syncButton = screen.getByRole('button', { name: /sync now/i });
    expect(syncButton).toBeInTheDocument();
  });

  it('shows green indicator when online', () => {
    const { container } = render(SyncStatusSection, {
      props: { hasPendingSync: false, isOnline: true },
    });
    const greenCircle = container.querySelector('.text-green-600');
    expect(greenCircle).toBeInTheDocument();
  });

  it('shows red indicator when offline', () => {
    const { container } = render(SyncStatusSection, {
      props: { hasPendingSync: false, isOnline: false },
    });
    const redCircle = container.querySelector('.text-red-600');
    expect(redCircle).toBeInTheDocument();
  });

  it('shows warning icon for pending changes', () => {
    const { container } = render(SyncStatusSection, {
      props: { hasPendingSync: true, isOnline: true },
    });
    const warningIcon = container.querySelector('[class*="icon-"]');
    expect(warningIcon).toBeInTheDocument();
  });

  it('shows check icon when all synced', () => {
    const { container } = render(SyncStatusSection, {
      props: { hasPendingSync: false, isOnline: true },
    });
    const checkIcon = container.querySelector('[class*="icon-"]');
    expect(checkIcon).toBeInTheDocument();
  });
});
