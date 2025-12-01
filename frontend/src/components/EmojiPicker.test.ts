import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EmojiPicker from './EmojiPicker.svelte';

describe('EmojiPicker Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the emoji picker button', () => {
    render(EmojiPicker);
    const button = screen.getByRole('button', { name: /select emoji/i });
    expect(button).toBeInTheDocument();
  });

  it('shows placeholder emoji when no value is set', () => {
    render(EmojiPicker, { props: { value: '' } });
    const button = screen.getByRole('button', { name: /select emoji/i });
    expect(button).toHaveTextContent('😀');
  });

  it('shows the selected emoji when value is set', () => {
    render(EmojiPicker, { props: { value: '🎉' } });
    const button = screen.getByRole('button', { name: /change emoji/i });
    expect(button).toHaveTextContent('🎉');
  });

  it('shows clear button when emoji is selected', () => {
    render(EmojiPicker, { props: { value: '🎉' } });
    const clearButton = screen.getByRole('button', { name: /clear emoji/i });
    expect(clearButton).toBeInTheDocument();
  });

  it('does not show clear button when no emoji is selected', () => {
    render(EmojiPicker, { props: { value: '' } });
    const clearButton = screen.queryByRole('button', { name: /clear emoji/i });
    expect(clearButton).not.toBeInTheDocument();
  });

  it('toggles picker visibility when button is clicked', async () => {
    render(EmojiPicker);
    const button = screen.getByRole('button', { name: /select emoji/i });
    
    // Initially picker should not be visible
    expect(document.querySelector('emoji-picker')).not.toBeInTheDocument();
    
    // Click to show picker
    await fireEvent.click(button);
    expect(document.querySelector('emoji-picker')).toBeInTheDocument();
    
    // Click again to hide picker
    await fireEvent.click(button);
    expect(document.querySelector('emoji-picker')).not.toBeInTheDocument();
  });
});
