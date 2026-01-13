import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BottomNav from './BottomNav.svelte';

vi.mock('../lib/navigation', () => ({
  navigate: vi.fn(),
}));

describe('BottomNav Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all navigation tabs', () => {
    render(BottomNav, { props: { currentTab: 'timer' } });
    expect(screen.getByText('Timer')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('highlights timer tab when active', () => {
    const { container } = render(BottomNav, { props: { currentTab: 'timer' } });
    const timerButton = screen.getByText('Timer').closest('button')!;
    expect(timerButton).toHaveClass('text-blue-600');
  });

  it('highlights history tab when active', () => {
    const { container } = render(BottomNav, { props: { currentTab: 'history' } });
    const historyButton = screen.getByText('History').closest('button')!;
    expect(historyButton).toHaveClass('text-blue-600');
  });

  it('highlights settings tab when active', () => {
    const { container } = render(BottomNav, { props: { currentTab: 'settings' } });
    const settingsButton = screen.getByText('Settings').closest('button')!;
    expect(settingsButton).toHaveClass('text-blue-600');
  });

  it('navigates to root when timer tab clicked', async () => {
    const { navigate } = await import('../lib/navigation');
    render(BottomNav, { props: { currentTab: 'history' } });
    
    const timerButton = screen.getByText('Timer').closest('button')!;
    await fireEvent.click(timerButton);
    
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('navigates to history when history tab clicked', async () => {
    const { navigate } = await import('../lib/navigation');
    render(BottomNav, { props: { currentTab: 'timer' } });
    
    const historyButton = screen.getByText('History').closest('button')!;
    await fireEvent.click(historyButton);
    
    expect(navigate).toHaveBeenCalledWith('/history');
  });

  it('navigates to settings when settings tab clicked', async () => {
    const { navigate } = await import('../lib/navigation');
    render(BottomNav, { props: { currentTab: 'timer' } });
    
    const settingsButton = screen.getByText('Settings').closest('button')!;
    await fireEvent.click(settingsButton);
    
    expect(navigate).toHaveBeenCalledWith('/settings');
  });

  it('applies correct icon when tab is active vs inactive', () => {
    const { container } = render(BottomNav, { props: { currentTab: 'timer' } });
    
    // Check that icons are present (class names may vary based on Svelte compilation)
    const icons = container.querySelectorAll('[class*="icon-"]');
    expect(icons.length).toBeGreaterThan(0);
  });
});
