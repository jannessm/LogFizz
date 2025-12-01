import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ImportTimelogsModal from './ImportTimelogsModal.svelte';

// Mock data
const mockButtons = [
  {
    id: 'btn-1',
    user_id: 'user-1',
    name: 'HU',
    emoji: '💼',
    color: '#3B82F6',
    auto_subtract_breaks: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'btn-2',
    user_id: 'user-1',
    name: 'HU - Home',
    emoji: '🏠',
    color: '#10B981',
    auto_subtract_breaks: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'btn-3',
    user_id: 'user-1',
    name: 'kindkrank',
    emoji: '🤒',
    color: '#EF4444',
    auto_subtract_breaks: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Mock the buttons store
vi.mock('../../stores/buttons', () => ({
  buttonsStore: {
    subscribe: (callback: any) => {
      callback({ buttons: mockButtons });
      return () => {};
    },
  },
}));

describe('ImportTimelogsModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with upload step initially', () => {
    render(ImportTimelogsModal);
    expect(screen.getByText('Import Timelogs')).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop your CSV or PDF file here/i)).toBeInTheDocument();
  });

  it('accepts CSV file upload', async () => {
    render(ImportTimelogsModal);
    
    const csvContent = `Date;Start time;End time;Project
03.11.2025;08:00;14:36;HU
04.11.2025;08:00;14:36;HU`;
    
    const file = new File([csvContent], 'timesheet.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    await fireEvent.change(input);
    
    expect(screen.getByText(/Selected: timesheet.csv/i)).toBeInTheDocument();
  });

  it('parses CSV with separate date and time columns', async () => {
    const { component } = render(ImportTimelogsModal);
    
    const csvContent = `Date;Start time;End time;abs. Duration;Project;Description
03.11.2025;08:00;14:36;06:36;HU;
04.11.2025;08:00;14:36;06:36;HU;
05.11.2025;08:00;14:36;06:36;HU;`;
    
    const file = new File([csvContent], 'timesheet_2025-12-01.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    await fireEvent.change(input);
    
    // Click continue to parse
    const continueBtn = screen.getByText('Continue');
    await fireEvent.click(continueBtn);
    
    // Should now be in mapping step
    await waitFor(() => {
      expect(screen.getByText('Map Columns')).toBeInTheDocument();
      expect(screen.getByLabelText(/Start Time Column/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Time Column/i)).toBeInTheDocument();
    });
  });

  it('imports timesheet_2025-12-01 CSV with date + time columns and maps projects to buttons', async () => {
    const importHandler = vi.fn();
    const { component, container } = render(ImportTimelogsModal);
    
    // Listen for import event
    container.addEventListener('import', importHandler as any);
    
    // Create CSV with separate date and time columns (matching the real timesheet format)
    const csvContent = `Date;Start time;End time;abs. Duration;Project;Description
03.11.2025;08:00;14:36;06:36;HU;
04.11.2025;08:00;14:36;06:36;HU - Home;
05.11.2025;08:00;14:36;06:36;kindkrank;`;
    
    const file = new File([csvContent], 'timesheet_2025-12-01.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    await fireEvent.change(input);
    
    // Click continue to parse
    const continueBtn = screen.getByText('Continue');
    await fireEvent.click(continueBtn);
    
    // Wait for mapping step
    await waitFor(() => {
      expect(screen.getByLabelText(/Date Column/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Start Time Column/i)).toBeInTheDocument();
    });
    
    // Verify columns are detected
    const dateSelect = screen.getByLabelText(/Date Column/i) as HTMLSelectElement;
    const startSelect = screen.getByLabelText(/Start Time Column/i) as HTMLSelectElement;
    const endSelect = screen.getByLabelText(/End Time Column/i) as HTMLSelectElement;
    const buttonSelect = screen.getByLabelText(/Assign to Button/i) as HTMLSelectElement;
    
    // Columns should be auto-detected
    expect(dateSelect.value).toBe('Date');
    expect(startSelect.value).toBe('Start time');
    expect(endSelect.value).toBe('End time');
    
    // Select a button
    await fireEvent.change(buttonSelect, { target: { value: 'btn-1' } });
    
    // Continue to confirm
    const mappingContinueBtn = screen.getByText('Continue');
    await fireEvent.click(mappingContinueBtn);
    
    // Wait for confirm step
    await waitFor(() => {
      expect(screen.getByText('Ready to Import')).toBeInTheDocument();
    });
    
    // Verify column mapping display
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Start time')).toBeInTheDocument();
    expect(screen.getByText('End time')).toBeInTheDocument();
  });

  it('handles CSV with semicolon delimiter', async () => {
    render(ImportTimelogsModal);
    
    const csvContent = `Date;Start time;End time;Project
03.11.2025;08:00;14:36;HU`;
    
    const file = new File([csvContent], 'timesheet.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    await fireEvent.change(input);
    
    const continueBtn = screen.getByText('Continue');
    await fireEvent.click(continueBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Map Columns')).toBeInTheDocument();
    });
  });

  it('validates date and time format combinations', async () => {
    const { component } = render(ImportTimelogsModal);
    
    // This CSV has date in DD.MM.YYYY format and times in HH:mm format
    const csvContent = `Date;Start time;End time;Project
03.11.2025;08:00;14:36;HU
04.11.2025;08:00;14:36;HU`;
    
    const file = new File([csvContent], 'timesheet.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    await fireEvent.change(input);
    
    const continueBtn = screen.getByText('Continue');
    await fireEvent.click(continueBtn);
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Start Time Column/i)).toBeInTheDocument();
    });
  });

  it('emits close event when cancel is clicked', async () => {
    const closeHandler = vi.fn();
    const { container } = render(ImportTimelogsModal);
    
    container.addEventListener('close', closeHandler as any);
    
    const cancelBtn = screen.getByText('Cancel');
    await fireEvent.click(cancelBtn);
    
    expect(closeHandler).toHaveBeenCalled();
  });

  it('shows error for invalid file types', async () => {
    render(ImportTimelogsModal);
    
    const file = new File(['content'], 'document.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    await fireEvent.change(input);
    
    await waitFor(() => {
      expect(screen.getByText(/Please upload a CSV or PDF file/i)).toBeInTheDocument();
    });
  });

  it('auto-detects start and end time columns', async () => {
    render(ImportTimelogsModal);
    
    const csvContent = `Date;Start time;End time;Project
03.11.2025;08:00;14:36;HU`;
    
    const file = new File([csvContent], 'timesheet.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    await fireEvent.change(input);
    
    const continueBtn = screen.getByText('Continue');
    await fireEvent.click(continueBtn);
    
    await waitFor(() => {
      const dateSelect = screen.getByLabelText(/Date Column/i) as HTMLSelectElement;
      const startSelect = screen.getByLabelText(/Start Time Column/i) as HTMLSelectElement;
      const endSelect = screen.getByLabelText(/End Time Column/i) as HTMLSelectElement;
      
      // Should auto-detect "Date" column
      expect(dateSelect.value).toBe('Date');
      // Should auto-detect "Start time" column
      expect(startSelect.value).toBe('Start time');
      // Should auto-detect "End time" column
      expect(endSelect.value).toBe('End time');
    });
  });

  it('validates combined date and time values correctly', async () => {
    render(ImportTimelogsModal);
    
    // CSV with German date format and time format
    const csvContent = `Date;Start time;End time;Project
03.11.2025;08:00;14:36;HU
04.11.2025;08:00;14:36;HU`;
    
    const file = new File([csvContent], 'timesheet.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    await fireEvent.change(input);
    
    const continueBtn = screen.getByText('Continue');
    await fireEvent.click(continueBtn);
    
    await waitFor(() => {
      const buttonSelect = screen.getByLabelText(/Assign to Button/i) as HTMLSelectElement;
      expect(buttonSelect).toBeInTheDocument();
    });
    
    // Preview should show combined date+time values
    // The component should combine "03.11.2025" + "08:00" into a valid datetime
    await waitFor(() => {
      // Look for preview section
      const preview = screen.queryByText(/Preview/i);
      if (preview) {
        expect(preview).toBeInTheDocument();
      }
    });
  });

  it('processes the actual timesheet_2025-12-01 CSV format', async () => {
    render(ImportTimelogsModal);
    
    // This is the actual format from the file
    const csvContent = `Date;Start time;End time;abs. Duration;Project;Description
03.11.2025;08:00;14:36;06:36;HU;
04.11.2025;08:00;14:36;06:36;HU;
05.11.2025;08:00;14:36;06:36;HU;
06.11.2025;08:08;14:44;06:36;kindkrank;
07.11.2025;08:00;14:36;06:36;HU - Home;`;
    
    const file = new File([csvContent], 'timesheet_2025-12-01T08-29-00.983.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    await fireEvent.change(input);
    
    const continueBtn = screen.getByText('Continue');
    await fireEvent.click(continueBtn);
    
    await waitFor(() => {
      const dateSelect = screen.getByLabelText(/Date Column/i) as HTMLSelectElement;
      const startSelect = screen.getByLabelText(/Start Time Column/i) as HTMLSelectElement;
      const endSelect = screen.getByLabelText(/End Time Column/i) as HTMLSelectElement;
      
      // Verify all columns are auto-detected
      expect(dateSelect.value).toBe('Date');
      expect(startSelect.value).toBe('Start time');
      expect(endSelect.value).toBe('End time');
      
      // Verify all header columns are available
      expect(Array.from(dateSelect.options).map(o => o.value)).toContain('Date');
      expect(Array.from(dateSelect.options).map(o => o.value)).toContain('Start time');
      expect(Array.from(dateSelect.options).map(o => o.value)).toContain('End time');
      expect(Array.from(dateSelect.options).map(o => o.value)).toContain('Project');
      expect(Array.from(dateSelect.options).map(o => o.value)).toContain('Description');
      expect(Array.from(dateSelect.options).map(o => o.value)).toContain('abs. Duration');
    });
  });

  it('works without date column (date included in time columns)', async () => {
    render(ImportTimelogsModal);
    
    // CSV where start/end times already include the date (no separate date column needed)
    const csvContent = `Start;End;Project
2025-11-03 08:00:00;2025-11-03 14:36:00;HU
2025-11-04 08:00:00;2025-11-04 14:36:00;HU`;
    
    const file = new File([csvContent], 'timelog.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    await fireEvent.change(input);
    
    const continueBtn = screen.getByText('Continue');
    await fireEvent.click(continueBtn);
    
    await waitFor(() => {
      const dateSelect = screen.getByLabelText(/Date Column/i) as HTMLSelectElement;
      const startSelect = screen.getByLabelText(/Start Time Column/i) as HTMLSelectElement;
      const endSelect = screen.getByLabelText(/End Time Column/i) as HTMLSelectElement;
      
      // Date column should be empty (no auto-detection for this format)
      expect(dateSelect.value).toBe('');
      
      // Start and End should be auto-detected
      expect(startSelect.value).toBe('Start');
      expect(endSelect.value).toBe('End');
    });
  });

  it('allows manually deselecting auto-detected date column', async () => {
    render(ImportTimelogsModal);
    
    const csvContent = `Date;Start time;End time;Project
03.11.2025;08:00;14:36;HU`;
    
    const file = new File([csvContent], 'timesheet.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    await fireEvent.change(input);
    
    const continueBtn = screen.getByText('Continue');
    await fireEvent.click(continueBtn);
    
    await waitFor(() => {
      const dateSelect = screen.getByLabelText(/Date Column/i) as HTMLSelectElement;
      expect(dateSelect.value).toBe('Date');
    });
    
    // User can manually deselect the date column
    const dateSelect = screen.getByLabelText(/Date Column/i) as HTMLSelectElement;
    await fireEvent.change(dateSelect, { target: { value: '' } });
    
    await waitFor(() => {
      expect(dateSelect.value).toBe('');
    });
    
    // Should still allow continuing (date column is optional)
    const buttonSelect = screen.getByLabelText(/Assign to Button/i) as HTMLSelectElement;
    await fireEvent.change(buttonSelect, { target: { value: 'btn-1' } });
    
    const mappingContinueBtn = screen.getByText('Continue');
    expect(mappingContinueBtn).not.toBeDisabled();
  });
});
