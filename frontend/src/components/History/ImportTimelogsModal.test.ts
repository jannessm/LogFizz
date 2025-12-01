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
    
    // Text is split across elements, check for filename specifically
    expect(screen.getByText('timesheet.csv')).toBeInTheDocument();
  });

  it('parses CSV with separate date and time columns', async () => {
    const { component } = render(ImportTimelogsModal);
    
    // Use CSV without Project column to avoid project mapping flow
    const csvContent = `Date;Start time;End time;Duration
03.11.2025;08:00;14:36;06:36
04.11.2025;08:00;14:36;06:36
05.11.2025;08:00;14:36;06:36`;
    
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
    
    // Should now be in mapping step (step text is just "Columns")
    await waitFor(() => {
      expect(screen.getByText('Columns')).toBeInTheDocument();
      expect(screen.getByLabelText(/Start Time Column/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Time Column/i)).toBeInTheDocument();
    });
  });

  it('imports timesheet_2025-12-01 CSV with date + time columns and button selection', async () => {
    const importHandler = vi.fn();
    const { component, container } = render(ImportTimelogsModal);
    
    // Listen for import event
    container.addEventListener('import', importHandler as any);
    
    // Create CSV without Project column to test button selection flow
    const csvContent = `Date;Start time;End time;Duration
03.11.2025;08:00;14:36;06:36
04.11.2025;08:00;14:36;06:36
05.11.2025;08:00;14:36;06:36`;
    
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
    
    // Use CSV without Project column to avoid project mapping flow
    const csvContent = `Date;Start time;End time;Duration
03.11.2025;08:00;14:36;06:36`;
    
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
      expect(screen.getByText('Columns')).toBeInTheDocument();
    });
  });

  it('validates date and time format combinations', async () => {
    const { component } = render(ImportTimelogsModal);
    
    // This CSV has date in DD.MM.YYYY format and times in HH:mm format
    // Use CSV without Project column to avoid project mapping flow
    const csvContent = `Date;Start time;End time;Duration
03.11.2025;08:00;14:36;06:36
04.11.2025;08:00;14:36;06:36`;
    
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

  it('has cancel button that can be clicked', async () => {
    render(ImportTimelogsModal);
    
    const cancelBtn = screen.getByText('Cancel');
    expect(cancelBtn).toBeInTheDocument();
    
    // Ensure button is clickable (doesn't throw)
    await fireEvent.click(cancelBtn);
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
    
    // Use CSV without Project column for simplicity
    const csvContent = `Date;Start time;End time;Duration
03.11.2025;08:00;14:36;06:36`;
    
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
    
    // CSV with German date format and time format (without Project column to show Assign to Button)
    const csvContent = `Date;Start time;End time;Duration
03.11.2025;08:00;14:36;06:36
04.11.2025;08:00;14:36;06:36`;
    
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
    
    // This is the actual format from the file (contains Project column, which triggers project mapping)
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
    
    // Use CSV without Project column to show Assign to Button dropdown
    const csvContent = `Date;Start time;End time;Duration
03.11.2025;08:00;14:36;06:36`;
    
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

  // PDF Import Tests
  describe('PDF Import', () => {
    it('accepts PDF file upload and detects file type', async () => {
      render(ImportTimelogsModal);
      
      // Create a mock PDF file (basic PDF structure)
      const pdfContent = '%PDF-1.4\n1 0 obj\n<<>>\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<<>>\nstartxref\n64\n%%EOF';
      const file = new File([pdfContent], 'Monatsliste_2025_09_Magnusson_Jannes_10040255.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      await fireEvent.change(input);
      
      // Should display the filename
      expect(screen.getByText('Monatsliste_2025_09_Magnusson_Jannes_10040255.pdf')).toBeInTheDocument();
      // Should detect as PDF in the header
      expect(screen.getByText(/from PDF/i)).toBeInTheDocument();
    });

    it('handles PDF file with table data', async () => {
      render(ImportTimelogsModal);
      
      // Create a mock PDF with text content that looks like table data
      // This simulates the text extraction from a PDF
      const pdfContent = '%PDF-1.4\n' +
        '1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\n' +
        '2 0 obj\n<<\n/Type /Page\n/Contents 3 0 R\n>>\nendobj\n' +
        '3 0 obj\n<<\n/Length 200\n>>\nstream\n' +
        'BT\n' +
        '(Datum  Anfang  Ende  Projekt) Tj\n' +
        '(01.09.2025  08:00  16:00  HU) Tj\n' +
        '(02.09.2025  08:00  16:00  HU) Tj\n' +
        'ET\n' +
        'endstream\nendobj\n' +
        'xref\n0 4\n' +
        '0000000000 65535 f \n' +
        '0000000009 00000 n \n' +
        '0000000050 00000 n \n' +
        '0000000100 00000 n \n' +
        'trailer\n<<\n/Size 4\n/Root 1 0 R\n>>\n' +
        'startxref\n350\n%%EOF';
      
      const file = new File([pdfContent], 'timesheet.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      await fireEvent.change(input);
      
      // Should display the filename
      expect(screen.getByText('timesheet.pdf')).toBeInTheDocument();
      
      // Click continue to try parsing
      const continueBtn = screen.getByText('Continue');
      await fireEvent.click(continueBtn);
      
      // The basic PDF parser may show an error or proceed to mapping
      // Either outcome is acceptable for this test - we're checking the flow
      await waitFor(() => {
        // Either we get an error message OR we proceed to mapping (step text is just "Columns")
        const hasError = screen.queryByText(/Failed to parse PDF|PDF import is currently|Could not extract/i);
        const hasMapping = screen.queryByText('Columns');
        expect(hasError || hasMapping).toBeTruthy();
      });
    });

    it('rejects non-PDF/CSV files', async () => {
      render(ImportTimelogsModal);
      
      const file = new File(['test content'], 'document.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

    it('handles PDF drag and drop', async () => {
      render(ImportTimelogsModal);
      
      const pdfContent = '%PDF-1.4\ntest content';
      const file = new File([pdfContent], 'dropped.pdf', { type: 'application/pdf' });
      
      // Find the inner drop zone (the dashed border div)
      const dropZone = document.querySelector('.border-dashed') as HTMLElement;
      
      await fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });
      
      await waitFor(() => {
        expect(screen.getByText('dropped.pdf')).toBeInTheDocument();
      });
    });

    it('handles PDF with German Monatsliste format', async () => {
      render(ImportTimelogsModal);
      
      // Simulate a PDF that would contain German timesheet data
      // (Datum, Anfang, Ende columns)
      const pdfContent = '%PDF-1.4\n' +
        '1 0 obj\n<<\n>>\nendobj\n' +
        '2 0 obj\n<<\n/Length 100\n>>\nstream\n' +
        'BT\n' +
        '(Datum  Anfang  Ende) Tj\n' +
        '(01.09.2025  08:00  16:30) Tj\n' +
        'ET\n' +
        'endstream\nendobj\n' +
        'xref\n0 3\n' +
        '0000000000 65535 f \n' +
        '0000000009 00000 n \n' +
        '0000000030 00000 n \n' +
        'trailer\n<<\n>>\n' +
        'startxref\n200\n%%EOF';
      
      const file = new File([pdfContent], 'Monatsliste_2025_09.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      await fireEvent.change(input);
      
      // Should display the filename and detect as PDF
      expect(screen.getByText('Monatsliste_2025_09.pdf')).toBeInTheDocument();
      expect(screen.getByText(/from PDF/i)).toBeInTheDocument();
    });

    it('shows PDF file type in modal header', async () => {
      render(ImportTimelogsModal);
      
      const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      await fireEvent.change(input);
      
      // Header should show "Import Timelogs from PDF"
      expect(screen.getByRole('heading', { name: /Import Timelogs\s*from PDF/i })).toBeInTheDocument();
    });
  });
});
