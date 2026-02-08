import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SetupModal from './SetupModal.svelte';

// Mock the i18n module
vi.mock('../lib/i18n', () => ({
  _: {
    subscribe: (fn: (value: (key: string) => string) => void) => {
      fn((key: string) => key);
      return () => {};
    }
  },
  setLocale: vi.fn()
}));

// Mock the dateFormatting module
vi.mock('../lib/dateFormatting', () => ({
  setDayjsLocale: vi.fn()
}));

// Mock the userSettingsStore
vi.mock('../stores/userSettings', () => ({
  userSettingsStore: {
    updateSettings: vi.fn().mockResolvedValue(undefined)
  }
}));

// Mock the db module
vi.mock('../lib/db', () => ({
  saveSetting: vi.fn().mockResolvedValue(undefined)
}));

// Mock the types module for dayjs
vi.mock('../types', () => ({
  dayjs: () => ({
    locale: () => ({
      format: () => 'January 1, 2024 - 01/01/2024 - 12:00 PM'
    })
  })
}));

describe('SetupModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with title', () => {
    const oncomplete = vi.fn();
    const { container } = render(SetupModal, {
      props: {
        oncomplete
      }
    });

    expect(container.textContent).toContain('setup.title');
  });

  it('renders language select', () => {
    const oncomplete = vi.fn();
    const { container } = render(SetupModal, {
      props: {
        oncomplete
      }
    });

    const languageSelect = container.querySelector('#setup-language');
    expect(languageSelect).not.toBeNull();
  });

  it('renders locale select', () => {
    const oncomplete = vi.fn();
    const { container } = render(SetupModal, {
      props: {
        oncomplete
      }
    });

    const localeSelect = container.querySelector('#setup-locale');
    expect(localeSelect).not.toBeNull();
  });

  it('renders get started button', () => {
    const oncomplete = vi.fn();
    const { container } = render(SetupModal, {
      props: {
        oncomplete
      }
    });

    expect(container.textContent).toContain('setup.getStarted');
  });

  it('does not show close button', () => {
    const oncomplete = vi.fn();
    const { container } = render(SetupModal, {
      props: {
        oncomplete
      }
    });

    // Close button should not exist since we set showCloseButton={false}
    const closeButton = container.querySelector('[aria-label="common.close"]');
    expect(closeButton).toBeNull();
  });

  it('calls oncomplete when form is submitted', async () => {
    const oncomplete = vi.fn();
    const { container } = render(SetupModal, {
      props: {
        oncomplete
      }
    });

    // Find and click the submit button
    const submitButton = container.querySelector('button[type="button"]');
    if (submitButton) {
      await fireEvent.click(submitButton);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(oncomplete).toHaveBeenCalled();
    }
  });

  it('has language options for English and German', () => {
    const oncomplete = vi.fn();
    const { container } = render(SetupModal, {
      props: {
        oncomplete
      }
    });

    const languageSelect = container.querySelector('#setup-language') as HTMLSelectElement;
    expect(languageSelect).not.toBeNull();
    
    const options = languageSelect?.querySelectorAll('option');
    expect(options?.length).toBe(2);
    
    const values = Array.from(options || []).map(opt => opt.value);
    expect(values).toContain('en');
    expect(values).toContain('de');
  });
});
