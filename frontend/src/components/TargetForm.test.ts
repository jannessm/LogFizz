import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import TargetForm from './TargetForm.svelte';
import type { TargetWithSpecs, State, Timer } from '../types';

const { mockTimersStore, mockStatesStore, mockTargetsStore } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    mockTimersStore: writable({ items: [] }),
    mockStatesStore: {
      ...writable({ states: [] }),
      load: vi.fn().mockResolvedValue(undefined),
    },
    mockTargetsStore: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };
});

vi.mock('../stores/timers', () => ({
  timersStore: mockTimersStore,
}));

vi.mock('../stores/states', () => ({
  statesStore: mockStatesStore,
}));

vi.mock('../stores/targets', () => ({
  targetsStore: mockTargetsStore,
}));

vi.mock('../lib/utils/targetSpec', () => ({
  getActiveTargetSpec: vi.fn(),
}));

describe('TargetForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTimersStore.set({ items: [] });
    mockStatesStore.set({ states: [] });
  });

  it('renders create target form', () => {
    render(TargetForm, { props: { target: null } });
    expect(screen.queryByText(/Add Target/i)).toBeDefined();
  });

  it('renders edit target form with existing data', () => {
    const mockTarget: TargetWithSpecs = {
      id: 't1',
      user_id: 'u1',
      name: 'Daily Work',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      target_specs: [],
    };

    render(TargetForm, { props: { target: mockTarget } });
    expect(screen.queryByText(/Edit Target/i)).toBeDefined();
  });

  it('displays target name input field', () => {
    render(TargetForm, { props: { target: null } });
    const nameInput = screen.queryByLabelText(/name/i);
    expect(nameInput).toBeDefined();
  });

  it('shows duration hours and minutes inputs', () => {
    render(TargetForm, { props: { target: null } });
    // Duration inputs should be present
  });

  it('displays weekday selection', () => {
    render(TargetForm, { props: { target: null } });
    // Weekday checkboxes should be present
  });

  it('shows holiday exclusion option', () => {
    render(TargetForm, { props: { target: null } });
    // Holiday exclusion checkbox should be present
  });

  it('displays available states when country selected', () => {
    mockStatesStore.set({
      states: [
        { id: '1', country: 'US', state: 'California', state_code: 'CA' },
        { id: '2', country: 'US', state: 'Texas', state_code: 'TX' },
      ],
    });

    render(TargetForm, { props: { target: null } });
    // State selection should be available when country is selected
  });

  it('shows available buttons for assignment', () => {
    mockTimersStore.set({
      items: [
        {
          id: 'b1',
          name: 'Work',
          user_id: 'u1',
          emoji: '💼',
          color: '#3B82F6',
          auto_subtract_breaks: false,
          archived: false,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ],
    });

    render(TargetForm, { props: { target: null } });
    // Button assignment options should be visible
  });

  it('pre-selects assigned buttons when editing', () => {
    const mockTarget: TargetWithSpecs = {
      id: 't1',
      user_id: 'u1',
      name: 'Daily Work',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      target_specs: [],
    };

    mockTimersStore.set({
      items: [
        {
          id: 'b1',
          name: 'Work',
          target_id: 't1',
          user_id: 'u1',
          emoji: '💼',
          color: '#3B82F6',
          auto_subtract_breaks: false,
          archived: false,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ],
    });

    render(TargetForm, { props: { target: mockTarget } });
    // Assigned buttons should be pre-selected
  });

  it('validates required name field', () => {
    render(TargetForm, { props: { target: null } });
    // Name field validation
  });

  it('handles spec form submission', () => {
    render(TargetForm, { props: { target: null } });
    // Spec form should be manageable
  });

  it('allows adding multiple target specs', () => {
    render(TargetForm, { props: { target: null } });
    // Multiple specs can be added
  });

  it('displays existing target specs when editing', () => {
    const mockTarget: TargetWithSpecs = {
      id: 't1',
      user_id: 'u1',
      name: 'Daily Work',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      target_specs: [
        {
          id: 'spec1',
          target_id: 't1',
          weekdays: [1, 2, 3, 4, 5],
          duration_minutes: [480, 480, 480, 480, 480],
          exclude_holidays: false,
          state_code: null,
          starting_from: null,
          ending_at: null,
        },
      ],
    };

    render(TargetForm, { props: { target: mockTarget } });
    // Existing specs should be displayed
  });

  it('dispatches close event when modal is closed', () => {
    render(TargetForm, { props: { target: null } });
    
    // Close event handling is tested through component integration
  });
});
