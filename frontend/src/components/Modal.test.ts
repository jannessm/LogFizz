import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Modal from './Modal.svelte';

describe('Modal Component', () => {
  it('renders modal with title', () => {
    const { container } = render(Modal, {
      props: {
        title: 'Test Modal'
      }
    });

    expect(container.textContent).toContain('Test Modal');
  });

  it('calls onclose when clicking overlay', async () => {
    const onclose = vi.fn();
    const { container } = render(Modal, {
      props: {
        title: 'Test Modal',
        onclose
      }
    });

    const overlay = container.querySelector('[role="button"]');
    await fireEvent.click(overlay!);

    expect(onclose).toHaveBeenCalled();
  });

  it('calls onclose when pressing Escape', async () => {
    const onclose = vi.fn();
    const { container } = render(Modal, {
      props: {
        title: 'Test Modal',
        onclose
      }
    });

    const overlay = container.querySelector('[role="button"]');
    await fireEvent.keyDown(overlay!, { key: 'Escape' });

    expect(onclose).toHaveBeenCalled();
  });

  it('calls onclose when clicking close button', async () => {
    const onclose = vi.fn();
    const { container } = render(Modal, {
      props: {
        title: 'Test Modal',
        onclose
      }
    });

    const closeButton = container.querySelector('[aria-label="Close"]');
    await fireEvent.click(closeButton!);

    expect(onclose).toHaveBeenCalled();
  });

  it('does not call onclose when clicking modal content', async () => {
    const onclose = vi.fn();
    const { container } = render(Modal, {
      props: {
        title: 'Test Modal',
        onclose
      }
    });

    const modalContent = container.querySelector('[role="dialog"]');
    await fireEvent.click(modalContent!);

    expect(onclose).not.toHaveBeenCalled();
  });

  it('hides header when showHeader is false', () => {
    const { container } = render(Modal, {
      props: {
        title: 'Test Modal',
        showHeader: false
      }
    });

    expect(container.textContent).not.toContain('Test Modal');
  });

  it('hides close button when showCloseButton is false', () => {
    const { container } = render(Modal, {
      props: {
        title: 'Test Modal',
        showCloseButton: false
      }
    });

    const closeButton = container.querySelector('[aria-label="Close"]');
    expect(closeButton).toBeNull();
  });

  it('applies custom maxWidth', () => {
    const { container } = render(Modal, {
      props: {
        title: 'Test Modal',
        maxWidth: 'max-w-sm'
      }
    });

    const modalContent = container.querySelector('[role="dialog"]');
    expect(modalContent?.className).toContain('max-w-sm');
  });

  it('applies custom zIndex', () => {
    const { container } = render(Modal, {
      props: {
        title: 'Test Modal',
        zIndex: 'z-[60]'
      }
    });

    const overlay = container.querySelector('[role="button"]');
    expect(overlay?.className).toContain('z-[60]');
  });
});
