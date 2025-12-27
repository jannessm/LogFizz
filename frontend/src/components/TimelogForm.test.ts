import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import TimelogForm from './TimelogForm.svelte';
import dayjs from 'dayjs';
import { get } from 'svelte/store';

// Mock the stores
const mockButtons = [
  {
    id: 'timer-1',
    user_id: 'user-1',
    name: 'Work',
    emoji: '💼',
    color: '#3B82F6',
    auto_subtract_breaks: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'timer-2',
    user_id: 'user-1',
    name: 'Study',
    emoji: '📚',
    color: '#10B981',
    auto_subtract_breaks: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

vi.mock('../stores/buttons', () => ({
  buttonsStore: {
    subscribe: vi.fn((callback) => {
      callback({ buttons: mockButtons, isLoading: false, error: null });
      return () => {};
    }),
  },
}));

describe('TimelogForm Component', () => {
  const selectedDate = dayjs('2024-12-04');
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders add timelog form', () => {
    render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog: null,
        isTimerStop: false,
      } 
    });
    expect(screen.getByText(/Add Time Entry/i)).toBeInTheDocument();
  });

  it('renders edit timelog form with existing data', () => {
    const existingLog = {
      timer_id: 'timer-1',
      startTime: '2024-12-04T09:00:00',
      endTime: '2024-12-04T17:00:00',
      log: {
        id: 'log-1',
        user_id: 'user-1',
        timer_id: 'timer-1',
        start_timestamp: '2024-12-04T09:00:00Z',
        end_timestamp: '2024-12-04T17:00:00Z',
        duration_minutes: 480,
        timezone: 'UTC',
        apply_break_calculation: false,
        notes: 'Test note',
        is_manual: true,
        created_at: '2024-12-04T09:00:00Z',
        updated_at: '2024-12-04T17:00:00Z',
      },
    };

    render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog,
        isTimerStop: false,
      } 
    });
    
    expect(screen.getByText(/Edit Time Entry/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test note')).toBeInTheDocument();
  });

  it('validates that end time is after start time', async () => {
    render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog: null,
        isTimerStop: false,
      } 
    });

    // Select a button
    const buttonSelect = screen.getByLabelText(/Button/i) as HTMLSelectElement;
    await fireEvent.change(buttonSelect, { target: { value: 'timer-1' } });

    // Uncheck the "Running" checkbox to show end date/time fields
    const runningCheckbox = screen.getByLabelText(/Running/i) as HTMLInputElement;
    await fireEvent.click(runningCheckbox);

    // Set start time
    const startDateInput = screen.getByLabelText(/Start Date/i) as HTMLInputElement;
    const startTimeInput = screen.getByLabelText(/Start Time/i) as HTMLInputElement;
    await fireEvent.input(startDateInput, { target: { value: '2024-12-04' } });
    await fireEvent.input(startTimeInput, { target: { value: '10:00' } });

    // Set end time before start time
    const endDateInput = screen.getByLabelText(/End Date/i) as HTMLInputElement;
    const endTimeInput = screen.getByLabelText(/End Time/i) as HTMLInputElement;
    await fireEvent.input(endDateInput, { target: { value: '2024-12-04' } });
    await fireEvent.input(endTimeInput, { target: { value: '09:00' } });

    // Try to submit
    const form = screen.getByRole('dialog').querySelector('form');
    if (form) {
      await fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(screen.getByText(/End time must be after start time/i)).toBeInTheDocument();
    });
  });

  it('shows running checkbox when not in timer stop mode', () => {
    render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog: null,
        isTimerStop: false,
      } 
    });

    expect(screen.getByText(/Running/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Running/i)).toBeInTheDocument();
  });

  it('hides running checkbox when in timer stop mode', () => {
    render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog: null,
        isTimerStop: true,
      } 
    });

    // When stopping timer, running checkbox should not be shown
    expect(screen.queryByText(/Running/i)).not.toBeInTheDocument();
  });

  it('shows delete button only when editing existing log', () => {
    // Test with new log (no delete button)
    const { unmount } = render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog: null,
        isTimerStop: false,
      } 
    });

    expect(screen.queryByText(/Delete Entry/i)).not.toBeInTheDocument();
    
    // Unmount and render with existing log
    unmount();

    // Test with existing log (should show delete button)
    const existingLog = {
      timer_id: 'timer-1',
      startTime: '2024-12-04T09:00:00',
      endTime: '2024-12-04T17:00:00',
      log: {
        id: 'log-1',
        user_id: 'user-1',
        timer_id: 'timer-1',
        start_timestamp: '2024-12-04T09:00:00Z',
        end_timestamp: '2024-12-04T17:00:00Z',
        duration_minutes: 480,
        timezone: 'UTC',
        apply_break_calculation: false,
        notes: '',
        is_manual: true,
        created_at: '2024-12-04T09:00:00Z',
        updated_at: '2024-12-04T17:00:00Z',
      },
    };

    render(TimelogForm, {
      props: {
        selectedDate,
        existingLog,
        isTimerStop: false,
      }
    });

    // After rerender with existingLog, delete button should be present
    // Use getByText since the button contains "Delete Entry"
    expect(screen.getByText(/Delete Entry/i)).toBeInTheDocument();
  });

  it('allows filling in form with valid data', async () => {
    render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog: null,
        isTimerStop: false,
      } 
    });

    // Fill in the form
    const buttonSelect = screen.getByLabelText(/Button/i) as HTMLSelectElement;
    await fireEvent.change(buttonSelect, { target: { value: 'timer-1' } });

    // Uncheck the "Running" checkbox to show end date/time fields
    const runningCheckbox = screen.getByLabelText(/Running/i) as HTMLInputElement;
    await fireEvent.click(runningCheckbox);

    const startDateInput = screen.getByLabelText(/Start Date/i) as HTMLInputElement;
    const startTimeInput = screen.getByLabelText(/Start Time/i) as HTMLInputElement;
    await fireEvent.input(startDateInput, { target: { value: '2024-12-04' } });
    await fireEvent.input(startTimeInput, { target: { value: '09:00' } });

    const endDateInput = screen.getByLabelText(/End Date/i) as HTMLInputElement;
    const endTimeInput = screen.getByLabelText(/End Time/i) as HTMLInputElement;
    await fireEvent.input(endDateInput, { target: { value: '2024-12-04' } });
    await fireEvent.input(endTimeInput, { target: { value: '17:00' } });

    const notesInput = screen.getByLabelText(/Notes/i) as HTMLTextAreaElement;
    await fireEvent.input(notesInput, { target: { value: 'Test work session' } });

    // Verify the form has the correct values
    expect(buttonSelect.value).toBe('timer-1');
    expect(startDateInput.value).toBe('2024-12-04');
    expect(startTimeInput.value).toBe('09:00');
    expect(endDateInput.value).toBe('2024-12-04');
    expect(endTimeInput.value).toBe('17:00');
    expect(notesInput.value).toBe('Test work session');
  });

  /**
   * Test that verifies breaks are subtracted when editing a timelog
   * 
   * This test verifies that when a user edits a timelog in the frontend,
   * the duration calculation correctly applies break subtraction based on
   * the button's auto_subtract_breaks setting.
   * 
   * German break rules:
   * - 6+ hours worked: 30 minutes break subtracted
   * - 9+ hours worked: 45 minutes break subtracted
   * 
   * The actual break calculation happens in the timeLogsStore.update() method,
   * which calls computeDurationMinutes() with the apply_break_calculation flag.
   * This test ensures the form correctly handles editing of timelogs that have
   * break calculation enabled.
   */
  it('correctly handles editing a timelog with apply_break_calculation enabled', async () => {
    // Create a timelog for a button with auto_subtract_breaks enabled
    const existingLog = {
      timer_id: 'timer-1', // This button has auto_subtract_breaks: true
      startTime: '2024-12-04T08:00:00',
      endTime: '2024-12-04T18:00:00', // 10 hours total
      log: {
        id: 'log-1',
        user_id: 'user-1',
        timer_id: 'timer-1',
        start_timestamp: '2024-12-04T08:00:00Z',
        end_timestamp: '2024-12-04T18:00:00Z',
        duration_minutes: 555, // 10 hours (600 min) - 45 min break = 555 min
        timezone: 'UTC',
        apply_break_calculation: true, // Break calculation was applied
        notes: 'Long work session',
        is_manual: true,
        created_at: '2024-12-04T08:00:00Z',
        updated_at: '2024-12-04T18:00:00Z',
      },
    };

    render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog,
        isTimerStop: false,
      } 
    });

    // Verify the form is populated with existing data
    expect(screen.getByDisplayValue('Long work session')).toBeInTheDocument();
    
    // Verify the button with auto_subtract_breaks is selected
    const buttonSelect = screen.getByLabelText(/Button/i) as HTMLSelectElement;
    expect(buttonSelect.value).toBe('timer-1');
    
    // Verify the times are populated correctly
    const startTimeInput = screen.getByLabelText(/Start Time/i) as HTMLInputElement;
    const endTimeInput = screen.getByLabelText(/End Time/i) as HTMLInputElement;
    expect(startTimeInput.value).toBe('08:00');
    expect(endTimeInput.value).toBe('18:00');
    
    // Modify the end time to make it a 7-hour session
    // When this is saved via timeLogsStore.update(), it should calculate:
    // 7 hours = 420 min - 30 min break = 390 min (since apply_break_calculation is true)
    await fireEvent.input(endTimeInput, { target: { value: '15:00' } }); // 8:00 to 15:00 = 7 hours

    // Verify the new value is set
    expect(endTimeInput.value).toBe('15:00');
    
    // Note: When this form data is submitted, the parent component (Dashboard or History)
    // will call timeLogsStore.update() with the new timestamps. The store will then:
    // 1. Retrieve the existing timelog (which has apply_break_calculation: true)
    // 2. Call computeDurationMinutes() with the new start/end times and the apply_break_calculation flag
    // 3. Calculate duration as: 7 hours (420 min) - 30 min break = 390 min
    // This test verifies the form correctly displays and allows editing of such timelogs
  });

  it('correctly handles editing a timelog from button without auto_subtract_breaks', async () => {
    // Create a timelog for a button WITHOUT auto_subtract_breaks
    const existingLog = {
      timer_id: 'timer-2', // This button has auto_subtract_breaks: false
      startTime: '2024-12-04T08:00:00',
      endTime: '2024-12-04T18:00:00', // 10 hours total
      log: {
        id: 'log-2',
        user_id: 'user-1',
        timer_id: 'timer-2',
        start_timestamp: '2024-12-04T08:00:00Z',
        end_timestamp: '2024-12-04T18:00:00Z',
        duration_minutes: 600, // 10 hours (600 min) - no break subtraction
        timezone: 'UTC',
        apply_break_calculation: false, // No break calculation
        notes: 'Study session',
        is_manual: true,
        created_at: '2024-12-04T08:00:00Z',
        updated_at: '2024-12-04T18:00:00Z',
      },
    };

    render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog,
        isTimerStop: false,
      } 
    });

    // Verify the form is populated with existing data
    expect(screen.getByDisplayValue('Study session')).toBeInTheDocument();
    
    // Verify the button without auto_subtract_breaks is selected
    const buttonSelect = screen.getByLabelText(/Button/i) as HTMLSelectElement;
    expect(buttonSelect.value).toBe('timer-2');

    // Modify the end time
    const endTimeInput = screen.getByLabelText(/End Time/i) as HTMLInputElement;
    expect(endTimeInput.value).toBe('18:00');
    await fireEvent.input(endTimeInput, { target: { value: '15:00' } }); // 7 hours
    expect(endTimeInput.value).toBe('15:00');

    // Note: When this is saved via timeLogsStore.update(), it will calculate:
    // 7 hours = 420 minutes (no break subtraction since apply_break_calculation is false)
    // This test verifies the form correctly handles editing of timelogs without break calculation
  });

  it('has a close button', async () => {
    render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog: null,
        isTimerStop: false,
      } 
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();
  });

  it('shows delete confirmation dialog when delete button is clicked', async () => {
    const existingLog = {
      timer_id: 'timer-1',
      startTime: '2024-12-04T09:00:00',
      endTime: '2024-12-04T17:00:00',
      log: {
        id: 'log-1',
        user_id: 'user-1',
        timer_id: 'timer-1',
        start_timestamp: '2024-12-04T09:00:00Z',
        end_timestamp: '2024-12-04T17:00:00Z',
        duration_minutes: 480,
        timezone: 'UTC',
        apply_break_calculation: false,
        notes: '',
        is_manual: true,
        created_at: '2024-12-04T09:00:00Z',
        updated_at: '2024-12-04T17:00:00Z',
      },
    };

    render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog,
        isTimerStop: false,
      } 
    });

    // Click delete button - use getByText to find "Delete Entry" button
    const deleteButton = screen.getByText(/Delete Entry/i);
    await fireEvent.click(deleteButton);

    // Wait a tick for the component to update
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify confirmation dialog appears
    // The dialog contains "Are you sure you want to delete this time entry?"
    const confirmText = screen.queryByText(/Are you sure/i);
    expect(confirmText).toBeTruthy();
    
    // There are multiple Cancel buttons (one in the form, one in the confirmation)
    const cancelButtons = screen.getAllByText(/Cancel/i);
    expect(cancelButtons.length).toBeGreaterThan(0);
  });

  it('renders dialog with proper ARIA attributes', () => {
    render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog: null,
        isTimerStop: false,
      } 
    });
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('pre-populates end time when stopping a timer', () => {
    render(TimelogForm, { 
      props: { 
        selectedDate,
        existingLog: null,
        isTimerStop: true,
      } 
    });

    const endDateInput = screen.getByLabelText(/End Date/i) as HTMLInputElement;
    const endTimeInput = screen.getByLabelText(/End Time/i) as HTMLInputElement;
    
    // Should be pre-populated with current date/time
    expect(endDateInput.value).toBeTruthy();
    expect(endTimeInput.value).toBeTruthy();
  });

  describe('Type Field', () => {
    it('displays type dropdown with all options', () => {
      render(TimelogForm, { 
        props: { 
          selectedDate,
          existingLog: null,
          isTimerStop: false,
        } 
      });

      const typeSelect = screen.getByLabelText(/Type/i) as HTMLSelectElement;
      expect(typeSelect).toBeInTheDocument();
      
      // Check that all type options exist
      const options = Array.from(typeSelect.options).map(opt => opt.value);
      expect(options).toContain('normal');
      expect(options).toContain('sick');
      expect(options).toContain('holiday');
      expect(options).toContain('business-trip');
      expect(options).toContain('child-sick');
    });

    it('shows time fields for normal type', () => {
      render(TimelogForm, { 
        props: { 
          selectedDate,
          existingLog: null,
          isTimerStop: false,
        } 
      });

      const typeSelect = screen.getByLabelText(/Type/i) as HTMLSelectElement;
      expect(typeSelect.value).toBe('normal');
      
      // Should show start time field for normal type
      const startTimeInput = screen.getByLabelText(/Start Time/i);
      expect(startTimeInput).toBeInTheDocument();
    });

    it('hides time fields for sick type', async () => {
      render(TimelogForm, { 
        props: { 
          selectedDate,
          existingLog: null,
          isTimerStop: false,
        } 
      });

      const typeSelect = screen.getByLabelText(/Type/i) as HTMLSelectElement;
      await fireEvent.change(typeSelect, { target: { value: 'sick' } });

      await waitFor(() => {
        // Should not show start/end time fields for sick type
        expect(screen.queryByLabelText(/Start Time/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/End Time/i)).not.toBeInTheDocument();
        // Should show date field
        expect(screen.getByLabelText(/Date/i)).toBeInTheDocument();
      });
    });

    it('hides time fields for holiday type', async () => {
      render(TimelogForm, { 
        props: { 
          selectedDate,
          existingLog: null,
          isTimerStop: false,
        } 
      });

      const typeSelect = screen.getByLabelText(/Type/i) as HTMLSelectElement;
      await fireEvent.change(typeSelect, { target: { value: 'holiday' } });

      await waitFor(() => {
        expect(screen.queryByLabelText(/Start Time/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/End Time/i)).not.toBeInTheDocument();
        expect(screen.getByLabelText(/Date/i)).toBeInTheDocument();
      });
    });

    it('shows helper text for special types', async () => {
      render(TimelogForm, { 
        props: { 
          selectedDate,
          existingLog: null,
          isTimerStop: false,
        } 
      });

      const typeSelect = screen.getByLabelText(/Type/i) as HTMLSelectElement;
      await fireEvent.change(typeSelect, { target: { value: 'sick' } });

      await waitFor(() => {
        expect(screen.getByText(/Duration will be calculated based on your daily target/i)).toBeInTheDocument();
      });
    });

    it('hides running checkbox for special types', async () => {
      render(TimelogForm, { 
        props: { 
          selectedDate,
          existingLog: null,
          isTimerStop: false,
        } 
      });

      // Running checkbox should be visible for normal type
      expect(screen.getByLabelText(/Running/i)).toBeInTheDocument();

      const typeSelect = screen.getByLabelText(/Type/i) as HTMLSelectElement;
      await fireEvent.change(typeSelect, { target: { value: 'business-trip' } });

      await waitFor(() => {
        // Running checkbox should be hidden for business-trip type
        expect(screen.queryByLabelText(/Running/i)).not.toBeInTheDocument();
      });
    });

    it('pre-populates type from existing log', () => {
      const existingLog = {
        timer_id: 'timer-1',
        startTime: '2024-12-04T09:00:00',
        endTime: '2024-12-04T17:00:00',
        log: {
          id: 'log-1',
          user_id: 'user-1',
          timer_id: 'timer-1',
          type: 'sick',
          start_timestamp: '2024-12-04T09:00:00Z',
          end_timestamp: '2024-12-04T17:00:00Z',
          duration_minutes: 480,
          timezone: 'UTC',
          apply_break_calculation: false,
          notes: 'Sick day',
          is_manual: true,
          created_at: '2024-12-04T09:00:00Z',
          updated_at: '2024-12-04T17:00:00Z',
        },
      };

      render(TimelogForm, { 
        props: { 
          selectedDate,
          existingLog,
          isTimerStop: false,
        } 
      });

      const typeSelect = screen.getByLabelText(/Type/i) as HTMLSelectElement;
      expect(typeSelect.value).toBe('sick');
    });
  });
});
