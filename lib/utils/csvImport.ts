import dayjs from './dayjs.js';

/**
 * Supported date/time formats for parsing
 */
export const DATE_TIME_FORMATS = [
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DD HH:mm',
  'DD.MM.YYYY HH:mm:ss',
  'DD.MM.YYYY HH:mm',
  'DD/MM/YYYY HH:mm:ss',
  'DD/MM/YYYY HH:mm',
  'MM/DD/YYYY HH:mm:ss',
  'MM/DD/YYYY HH:mm',
  'YYYY-MM-DDTHH:mm:ss',
  'YYYY-MM-DDTHH:mm',
];

/**
 * Column detection patterns
 */
export const COLUMN_PATTERNS = {
  date: ['date', 'datum', 'day', 'tag'],
  startTime: ['start', 'begin', 'from', 'anfang'],
  endTime: ['end', 'stop', 'to', 'ende', 'bis'],
  notes: ['note', 'notes', 'notiz', 'notizen', 'description', 'beschreibung', 'comment', 'kommentar'],
} as const;

/**
 * Result of parsing a CSV file
 */
export interface ParsedCSV {
  headers: string[];
  data: string[][];
  delimiter: ',' | ';';
}

/**
 * Auto-detected columns
 */
export interface AutoDetectedColumns {
  dateColumn?: string;
  startTimeColumn?: string;
  endTimeColumn?: string;
  notesColumn?: string;
}

/**
 * Detects the delimiter used in a CSV line
 * Prefers comma, falls back to semicolon
 */
export function detectDelimiter(line: string): ',' | ';' {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Parses a single CSV line, respecting quoted fields
 */
export function parseCSVLine(line: string, delimiter: ',' | ';' = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses CSV text into headers and data rows
 */
export function parseCSV(text: string): ParsedCSV {
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter);
  const data = lines.slice(1).map(line => parseCSVLine(line, delimiter));

  return { headers, data, delimiter };
}

/**
 * Auto-detects date and time columns based on header names
 */
export function autoDetectColumns(headers: string[]): AutoDetectedColumns {
  const result: AutoDetectedColumns = {};

  for (const header of headers) {
    const lowerHeader = header.toLowerCase();
    
    if (!result.dateColumn && COLUMN_PATTERNS.date.some(p => lowerHeader.includes(p))) {
      result.dateColumn = header;
    }
    if (!result.startTimeColumn && COLUMN_PATTERNS.startTime.some(p => lowerHeader.includes(p))) {
      result.startTimeColumn = header;
    }
    if (!result.endTimeColumn && COLUMN_PATTERNS.endTime.some(p => lowerHeader.includes(p))) {
      result.endTimeColumn = header;
    }
    if (!result.notesColumn && COLUMN_PATTERNS.notes.some(p => lowerHeader.includes(p))) {
      result.notesColumn = header;
    }
  }

  return result;
}

/**
 * Combines a date string with a time string
 * If no date is provided, returns the time as-is (assuming it contains the date)
 */
export function combineDateAndTime(date: string, time: string): string {
  if (!date && !time) return '';
  if (!date) return time; // If no date, treat time as full datetime
  if (!time) return '';
  
  // Combine date and time: "03.11.2025" + "08:00" -> "03.11.2025 08:00"
  return `${date.trim()} ${time.trim()}`;
}

/**
 * Validates if a string is a valid date/time
 */
export function isValidDateTime(value: string): boolean {
  if (!value) return false;
  
  // Try all known formats
  for (const format of DATE_TIME_FORMATS) {
    const parsed = dayjs(value, format, true);
    if (parsed.isValid()) return true;
  }

  // Also try native Date parsing
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Parses a date/time string into a dayjs object
 * Returns null if the value cannot be parsed
 */
export function parseDateTime(value: string): dayjs.Dayjs | null {
  if (!value) return null;

  // Try all known formats
  for (const format of DATE_TIME_FORMATS) {
    const parsed = dayjs(value, format, true);
    if (parsed.isValid()) return parsed;
  }

  // Try native Date parsing
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return dayjs(date);
  }

  return null;
}

/**
 * Processes CSV data rows into timelog entries with combined date/time
 */
export interface TimelogRow {
  startValue: string;
  endValue: string;
  notes?: string;
  rowIndex: number;
}

export interface ProcessRowsOptions {
  data: string[][];
  headers: string[];
  dateColumn?: string;
  startTimeColumn: string;
  endTimeColumn: string;
  notesColumn?: string;
}

export function processTimelogRows(options: ProcessRowsOptions): TimelogRow[] {
  const { data, headers, dateColumn, startTimeColumn, endTimeColumn, notesColumn } = options;
  
  const dateIndex = dateColumn ? headers.indexOf(dateColumn) : -1;
  const startIndex = headers.indexOf(startTimeColumn);
  const endIndex = headers.indexOf(endTimeColumn);
  const notesIndex = notesColumn ? headers.indexOf(notesColumn) : -1;

  if (startIndex === -1 || endIndex === -1) {
    throw new Error('Start time and end time columns must be valid');
  }

  return data.map((row, index) => {
    const dateValue = dateIndex >= 0 ? row[dateIndex] || '' : '';
    const startTime = row[startIndex] || '';
    const endTime = row[endIndex] || '';
    const notes = notesIndex >= 0 ? row[notesIndex]?.trim() : undefined;
    
    return {
      startValue: combineDateAndTime(dateValue, startTime),
      endValue: combineDateAndTime(dateValue, endTime),
      notes: notes || undefined,
      rowIndex: index,
    };
  });
}

/**
 * Validates and converts timelog rows to ISO format
 */
export interface ValidatedTimelog {
  start_timestamp: string;
  end_timestamp: string;
  notes?: string;
}

export interface ValidationResult {
  valid: ValidatedTimelog[];
  errors: string[];
}

export function validateAndConvertTimelogs(rows: TimelogRow[]): ValidationResult {
  const valid: ValidatedTimelog[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const startDate = parseDateTime(row.startValue);
    const endDate = parseDateTime(row.endValue);

    if (startDate && endDate) {
      if (endDate.isAfter(startDate)) {
        const timelog: ValidatedTimelog = {
          start_timestamp: startDate.toISOString(),
          end_timestamp: endDate.toISOString(),
        };
        
        if (row.notes) {
          timelog.notes = row.notes;
        }
        
        valid.push(timelog);
      } else {
        errors.push(`Row ${row.rowIndex + 2}: End time is before start time`);
      }
    } else {
      if (!startDate) {
        errors.push(`Row ${row.rowIndex + 2}: Invalid start time "${row.startValue}"`);
      }
      if (!endDate) {
        errors.push(`Row ${row.rowIndex + 2}: Invalid end time "${row.endValue}"`);
      }
    }
  }

  return { valid, errors };
}

/**
 * Column detection patterns for project
 */
export const PROJECT_PATTERNS = ['project', 'projekt', 'category', 'kategorie', 'task', 'aufgabe'];

/**
 * Detects the project column in CSV headers
 */
export function detectProjectColumn(headers: string[]): string | undefined {
  for (const header of headers) {
    const lowerHeader = header.toLowerCase();
    if (PROJECT_PATTERNS.some(p => lowerHeader.includes(p))) {
      return header;
    }
  }
  return undefined;
}

/**
 * Detected project with metadata
 */
export interface DetectedProject {
  name: string;
  count: number;
  rowIndices: number[];
}

/**
 * Extracts unique projects from CSV data with their row counts
 */
export function detectProjectsInCSV(
  data: string[][],
  headers: string[],
  projectColumn: string
): DetectedProject[] {
  const projectIndex = headers.indexOf(projectColumn);
  
  if (projectIndex === -1) {
    return [];
  }

  const projectMap = new Map<string, DetectedProject>();

  data.forEach((row, index) => {
    const projectName = row[projectIndex]?.trim() || '(empty)';
    
    if (projectMap.has(projectName)) {
      const project = projectMap.get(projectName)!;
      project.count++;
      project.rowIndices.push(index);
    } else {
      projectMap.set(projectName, {
        name: projectName,
        count: 1,
        rowIndices: [index],
      });
    }
  });

  // Sort by count (most common first)
  return Array.from(projectMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * Complete CSV import pipeline
 */
export interface ImportCSVOptions {
  csvText: string;
  dateColumn?: string;
  startTimeColumn: string;
  endTimeColumn: string;
  notesColumn?: string;
}

export interface ImportCSVResult {
  timelogs: ValidatedTimelog[];
  errors: string[];
  skippedCount: number;
  totalCount: number;
}

export function importTimelogsFromCSV(options: ImportCSVOptions): ImportCSVResult {
  const { csvText, dateColumn, startTimeColumn, endTimeColumn, notesColumn } = options;
  
  // Parse CSV
  const parsed = parseCSV(csvText);
  
  // Process rows
  const rows = processTimelogRows({
    data: parsed.data,
    headers: parsed.headers,
    dateColumn,
    startTimeColumn,
    endTimeColumn,
    notesColumn,
  });
  
  // Validate and convert
  const result = validateAndConvertTimelogs(rows);
  
  return {
    timelogs: result.valid,
    errors: result.errors,
    skippedCount: parsed.data.length - result.valid.length,
    totalCount: parsed.data.length,
  };
}
