import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import DateTimeInput from './DateTimeInput.svelte';
import dayjs from '../../../../lib/utils/dayjs.js';
import { setDayjsLocale } from '../../lib/dateFormatting';

describe('DateTimeInput Component', () => {
  const testDate = dayjs('2024-12-15T14:30:00Z');
  const timezone = 'UTC';

  beforeEach(() => {
    // Use a 24-hour locale by default so existing time tests are unaffected
    setDayjsLocale('de-DE');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders date and time inputs', () => {
    render(DateTimeInput, {
      props: {
        value: testDate,
        timezone,
        dateLabel: 'Start Date',
        timeLabel: 'Start Time',
        dateId: 'startDate',
        timeId: 'startTime',
      }
    });

    expect(screen.getByLabelText(/Start Date/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Time/)).toBeInTheDocument();
  });

  it('renders only date input when dateOnly is true', () => {
    render(DateTimeInput, {
      props: {
        value: testDate,
        timezone,
        dateOnly: true,
        dateLabel: 'Date',
        dateId: 'date',
      }
    });

    expect(screen.getByLabelText(/Date/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Time/)).not.toBeInTheDocument();
  });

  it('displays correct date value', () => {
    render(DateTimeInput, {
      props: {
        value: testDate,
        timezone,
        dateLabel: 'Date',
        dateId: 'date',
      }
    });

    // de-DE locale formats as DD.MM.YYYY (L token)
    const dateInput = screen.getByLabelText(/Date/) as HTMLInputElement;
    expect(dateInput.value).toBe(testDate.format('L'));
  });

  it('displays correct time value', () => {
    render(DateTimeInput, {
      props: {
        value: testDate,
        timezone,
        dateLabel: 'Date',
        timeLabel: 'Time',
        dateId: 'date',
        timeId: 'time',
      }
    });

    const timeInput = screen.getByLabelText(/Time/) as HTMLInputElement;
    expect(timeInput.value).toBe('14:30');
  });

  it('disables inputs when disabled is true', () => {
    render(DateTimeInput, {
      props: {
        value: testDate,
        timezone,
        disabled: true,
        dateLabel: 'Date',
        timeLabel: 'Time',
        dateId: 'date',
        timeId: 'time',
      }
    });

    const dateInput = screen.getByLabelText(/Date/) as HTMLInputElement;
    const timeInput = screen.getByLabelText(/Time/) as HTMLInputElement;
    
    expect(dateInput).toBeDisabled();
    expect(timeInput).toBeDisabled();
  });

  it('disables only time input when timeDisabled is true', () => {
    render(DateTimeInput, {
      props: {
        value: testDate,
        timezone,
        timeDisabled: true,
        dateLabel: 'Date',
        timeLabel: 'Time',
        dateId: 'date',
        timeId: 'time',
      }
    });

    const dateInput = screen.getByLabelText(/Date/) as HTMLInputElement;
    const timeInput = screen.getByLabelText(/Time/) as HTMLInputElement;
    
    expect(dateInput).not.toBeDisabled();
    expect(timeInput).toBeDisabled();
  });

  it('shows error styling when hasError is true', () => {
    render(DateTimeInput, {
      props: {
        value: testDate,
        timezone,
        hasError: true,
        dateLabel: 'Date',
        timeLabel: 'Time',
        dateId: 'date',
        timeId: 'time',
      }
    });

    const dateInput = screen.getByLabelText(/Date/) as HTMLInputElement;
    const timeInput = screen.getByLabelText(/Time/) as HTMLInputElement;
    
    expect(dateInput).toHaveClass('border-red-500');
    expect(timeInput).toHaveClass('border-red-500');
  });

  it('updates value when date input changes', async () => {
    let capturedValue = testDate;
    
    render(DateTimeInput, {
      props: {
        get value() { return capturedValue; },
        set value(v) { capturedValue = v; },
        timezone,
        dateLabel: 'Date',
        dateId: 'date',
      }
    });

    // Type in locale format (de-DE → DD.MM.YYYY) and commit on blur
    const dateInput = screen.getByLabelText(/Date/) as HTMLInputElement;
    await fireEvent.input(dateInput, { target: { value: '20.12.2024' } });
    await fireEvent.blur(dateInput);

    expect(capturedValue.format('YYYY-MM-DD')).toBe('2024-12-20');
  });

  it('updates value when time input changes', async () => {
    let capturedValue = testDate;
    
    render(DateTimeInput, {
      props: {
        get value() { return capturedValue; },
        set value(v) { capturedValue = v; },
        timezone,
        dateLabel: 'Date',
        timeLabel: 'Time',
        dateId: 'date',
        timeId: 'time',
      }
    });

    const timeInput = screen.getByLabelText(/Time/) as HTMLInputElement;
    await fireEvent.input(timeInput, { target: { value: '16:45' } });

    expect(capturedValue.format('HH:mm')).toBe('16:45');
  });

  it('shows asterisk when required is true', () => {
    render(DateTimeInput, {
      props: {
        value: testDate,
        timezone,
        required: true,
        dateLabel: 'Date',
        timeLabel: 'Time',
        dateId: 'date',
        timeId: 'time',
      }
    });

    // Labels should contain asterisk
    const labels = screen.getAllByText(/\*/);
    expect(labels.length).toBe(2);
  });

  describe('String Value Mode', () => {
    it('renders with string value in date-only mode', () => {
      render(DateTimeInput, {
        props: {
          stringValue: '2024-12-15',
          dateOnly: true,
          dateLabel: 'Start Date',
          dateId: 'startDate',
        }
      });

      // String value '2024-12-15' is displayed in locale format (de-DE → 15.12.2024)
      const dateInput = screen.getByLabelText(/Start Date/) as HTMLInputElement;
      expect(dateInput.value).toBe(dayjs('2024-12-15').format('L'));
    });

    it('handles null string value', () => {
      render(DateTimeInput, {
        props: {
          stringValue: null,
          dateOnly: true,
          dateLabel: 'Date',
          dateId: 'date',
        }
      });

      const dateInput = screen.getByLabelText(/Date/) as HTMLInputElement;
      expect(dateInput.value).toBe('');
    });

    it('updates stringValue when date input changes', async () => {
      let capturedValue: string | null = '2024-12-15';
      
      render(DateTimeInput, {
        props: {
          get stringValue() { return capturedValue; },
          set stringValue(v) { capturedValue = v; },
          dateOnly: true,
          dateLabel: 'Date',
          dateId: 'date',
        }
      });

      // Type in locale format (de-DE → DD.MM.YYYY) and commit on blur
      const dateInput = screen.getByLabelText(/Date/) as HTMLInputElement;
      await fireEvent.input(dateInput, { target: { value: '20.12.2024' } });
      await fireEvent.blur(dateInput);

      expect(capturedValue).toBe('2024-12-20');
    });

    it('sets stringValue to null when date is cleared', async () => {
      let capturedValue: string | null = '2024-12-15';
      
      render(DateTimeInput, {
        props: {
          get stringValue() { return capturedValue; },
          set stringValue(v) { capturedValue = v; },
          dateOnly: true,
          dateLabel: 'Date',
          dateId: 'date',
        }
      });

      const dateInput = screen.getByLabelText(/Date/) as HTMLInputElement;
      await fireEvent.input(dateInput, { target: { value: '' } });
      await fireEvent.blur(dateInput);

      expect(capturedValue).toBe(null);
    });
  });

  describe('AM/PM toggle (12-hour clock)', () => {
    beforeEach(() => {
      setDayjsLocale('en-US'); // 12-hour locale
    });

    afterEach(() => {
      setDayjsLocale('en-US'); // reset
      cleanup();
    });

    it('shows AM/PM button when locale uses 12-hour clock', () => {
      render(DateTimeInput, {
        props: {
          value: testDate,
          timezone,
          dateLabel: 'Date',
          timeLabel: 'Time',
          dateId: 'date',
          timeId: 'time',
        }
      });

      expect(screen.getByRole('button', { name: /AM|PM/i })).toBeInTheDocument();
    });

    it('shows PM when hour is >= 12', () => {
      const pmDate = dayjs('2024-12-15T14:30:00Z'); // 2:30 PM
      render(DateTimeInput, {
        props: {
          value: pmDate,
          timezone,
          dateLabel: 'Date',
          timeLabel: 'Time',
          dateId: 'date',
          timeId: 'time',
        }
      });

      expect(screen.getByRole('button', { name: 'PM' })).toBeInTheDocument();
    });

    it('shows AM when hour is < 12', () => {
      const amDate = dayjs('2024-12-15T09:30:00Z'); // 9:30 AM
      render(DateTimeInput, {
        props: {
          value: amDate,
          timezone,
          dateLabel: 'Date',
          timeLabel: 'Time',
          dateId: 'date',
          timeId: 'time',
        }
      });

      expect(screen.getByRole('button', { name: 'AM' })).toBeInTheDocument();
    });

    it('toggles from PM to AM and updates value', async () => {
      let capturedValue = dayjs('2024-12-15T14:30:00Z'); // 2:30 PM
      render(DateTimeInput, {
        props: {
          get value() { return capturedValue; },
          set value(v) { capturedValue = v; },
          timezone,
          dateLabel: 'Date',
          timeLabel: 'Time',
          dateId: 'date',
          timeId: 'time',
        }
      });

      const button = screen.getByRole('button', { name: 'PM' });
      await fireEvent.click(button);

      expect(capturedValue.hour()).toBe(2); // 14 - 12 = 2 AM
    });

    it('toggles from AM to PM and updates value', async () => {
      let capturedValue = dayjs('2024-12-15T09:30:00Z'); // 9:30 AM
      render(DateTimeInput, {
        props: {
          get value() { return capturedValue; },
          set value(v) { capturedValue = v; },
          timezone,
          dateLabel: 'Date',
          timeLabel: 'Time',
          dateId: 'date',
          timeId: 'time',
        }
      });

      const button = screen.getByRole('button', { name: 'AM' });
      await fireEvent.click(button);

      expect(capturedValue.hour()).toBe(21); // 9 + 12 = 21
    });

    it('does not show AM/PM button when locale uses 24-hour clock', () => {
      setDayjsLocale('de-DE');
      render(DateTimeInput, {
        props: {
          value: testDate,
          timezone,
          dateLabel: 'Date',
          timeLabel: 'Time',
          dateId: 'date',
          timeId: 'time',
        }
      });

      expect(screen.queryByRole('button', { name: /AM|PM/i })).not.toBeInTheDocument();
    });

    it('displays time in 12-hour format in the time input', () => {
      const pmDate = dayjs('2024-12-15T14:30:00Z'); // 14:30 → 02:30 (PM)
      render(DateTimeInput, {
        props: {
          value: pmDate,
          timezone,
          dateLabel: 'Date',
          timeLabel: 'Time',
          dateId: 'date',
          timeId: 'time',
        }
      });

      const timeInput = screen.getByLabelText(/Time/) as HTMLInputElement;
      expect(timeInput.value).toBe('02:30');
    });
  });
});
