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
 * Column detection patterns.
 *
 * Each column type has two lists:
 *   exact    – header must equal the pattern (case-insensitive); checked first
 *   contains – header must contain the pattern as a substring; checked second
 *
 * Detection order within each round: startTime → endTime → startDate → endDate → notes.
 * Time slots are filled before date slots so that:
 *   - In a simple layout [Begin, End]:  End → endTimeColumn
 *   - In a split layout [Start, Startzeit, Ende, Endzeit]:
 *       Startzeit → startTimeColumn (exact), Endzeit → endTimeColumn (exact),
 *       then Start → startDateColumn, Ende → endDateColumn (next header iteration)
 */
export const COLUMN_PATTERNS = {
  startDate: {
    exact: ['startdate', 'start date', 'start_date', 'date', 'datum', 'day', 'tag'],
    // 'start' and 'beginn' are intentionally not in `exact` here —
    // they live in startTime.exact and are promoted to startDate only
    // in round 2 (contains) when the startTime slot is already taken.
    contains: ['startdate', 'start date', 'start_date', 'datum', 'start', 'beginn'],
  },
  endDate: {
    exact: ['enddate', 'end date', 'end_date'],
    // 'ende' and 'end' are promoted to endDate in round 2 when endTime is taken.
    contains: ['enddate', 'end date', 'end_date', 'ende', 'end'],
  },
  startTime: {
    exact: ['startzeit', 'start time', 'start_time', 'start', 'beginn', 'begin', 'from', 'anfang'],
    contains: ['startzeit', 'start time', 'start_time', 'start', 'beginn', 'begin', 'anfang'],
  },
  endTime: {
    exact: ['endzeit', 'end time', 'end_time', 'ende', 'end', 'stop', 'to', 'bis'],
    contains: ['endzeit', 'end time', 'end_time', 'ende', 'end', 'stop', 'bis'],
  },
  notes: {
    exact: ['note', 'notes', 'notiz', 'notizen', 'description', 'beschreibung', 'comment', 'kommentar'],
    contains: ['note', 'notiz', 'description', 'beschreibung', 'comment', 'kommentar'],
  },
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
  startDateColumn?: string;
  endDateColumn?: string;
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
 * Auto-detects date and time columns based on header names.
 *
 * Each pattern set has two lists:
 *   exact    – header must equal the pattern (case-insensitive); checked first
 *   contains – header must contain the pattern as a substring; checked second
 *
 * Within the exact round, headers are sorted by length (longest first) so
 * that more-specific names like "Startzeit" are assigned before shorter
 * names like "Start" that match the same slot.
 *
 * Detection order within each round: startTime → endTime → startDate → endDate → notes.
 * Time slots are filled before date slots so that bare words like "Start"/"Ende"
 * fall through to date slots when a *Zeit column already claimed the time slot.
 *
 * This handles both layouts correctly:
 *   Simple:  [Begin, End]              → startTime=Begin, endTime=End
 *   German:  [Start, Startzeit, Ende, Endzeit]
 *              → startTime=Startzeit, startDate=Start,
 *                 endTime=Endzeit,    endDate=Ende
 */
export function autoDetectColumns(headers: string[]): AutoDetectedColumns {
  const result: AutoDetectedColumns = {};
  const assignedHeaders = new Set<string>();

  type ColKey = 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'notes';
  const resultKey: Record<ColKey, keyof AutoDetectedColumns> = {
    startDate: 'startDateColumn',
    endDate: 'endDateColumn',
    startTime: 'startTimeColumn',
    endTime: 'endTimeColumn',
    notes: 'notesColumn',
  };
  const order: ColKey[] = ['startTime', 'endTime', 'startDate', 'endDate', 'notes'];

  // Round 1: exact match — sort headers longest-first so "Startzeit" (9 chars)
  // is assigned before "Start" (5 chars) when both are present in the same CSV.
  const byLengthDesc = [...headers].sort((a, b) => b.length - a.length);
  for (const header of byLengthDesc) {
    const lower = header.toLowerCase();
    for (const col of order) {
      if (result[resultKey[col]]) continue;
      if (COLUMN_PATTERNS[col].exact.some((p: string) => lower === p)) {
        result[resultKey[col]] = header;
        assignedHeaders.add(header);
        break;
      }
    }
  }

  // Round 2: substring match — original header order, skip already-assigned
  for (const header of headers) {
    if (assignedHeaders.has(header)) continue;
    const lower = header.toLowerCase();
    for (const col of order) {
      if (result[resultKey[col]]) continue;
      if (COLUMN_PATTERNS[col].contains.some((p: string) => lower.includes(p))) {
        result[resultKey[col]] = header;
        assignedHeaders.add(header);
        break;
      }
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
export function isValidDateTime(value: string, customFormats?: string[]): boolean {
  if (!value) return false;
  
  // Try custom formats first if provided
  if (customFormats && customFormats.length > 0) {
    for (const format of customFormats) {
      const parsed = dayjs(value, format, true);
      if (parsed.isValid()) return true;
    }
  }

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
 * Parses a date/time string into a dayjs object with optional timezone
 * Returns null if the value cannot be parsed
 */
export function parseDateTime(value: string, timezone?: string, customFormats?: string[]): dayjs.Dayjs | null {
  if (!value) return null;

  // Try custom formats first if provided
  if (customFormats && customFormats.length > 0) {
    for (const format of customFormats) {
      const parsed = dayjs(value, format, true);
      if (parsed.isValid()) {
        return timezone ? parsed.tz(timezone, true) : parsed;
      }
    }
  }

  // Try all known formats
  for (const format of DATE_TIME_FORMATS) {
    const parsed = dayjs(value, format, true);
    if (parsed.isValid()) {
      return timezone ? parsed.tz(timezone, true) : parsed;
    }
  }

  // Try native Date parsing
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    const parsed = dayjs(date);
    return timezone ? parsed.tz(timezone, true) : parsed;
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
  startDateColumn?: string;
  endDateColumn?: string;
  startTimeColumn: string;
  endTimeColumn: string;
  notesColumn?: string;
}

export function processTimelogRows(options: ProcessRowsOptions): TimelogRow[] {
  const { data, headers, startDateColumn, endDateColumn, startTimeColumn, endTimeColumn, notesColumn } = options;
  
  const startDateIndex = startDateColumn ? headers.indexOf(startDateColumn) : -1;
  const endDateIndex = endDateColumn ? headers.indexOf(endDateColumn) : -1;
  const startIndex = headers.indexOf(startTimeColumn);
  const endIndex = headers.indexOf(endTimeColumn);
  const notesIndex = notesColumn ? headers.indexOf(notesColumn) : -1;

  if (startIndex === -1 || endIndex === -1) {
    throw new Error('Start time and end time columns must be valid');
  }

  return data.map((row, index) => {
    const startDateValue = startDateIndex >= 0 ? row[startDateIndex] || '' : '';
    // If no end date column specified, use start date column
    const endDateValue = endDateIndex >= 0 ? row[endDateIndex] || '' : startDateValue;
    const startTime = row[startIndex] || '';
    const endTime = row[endIndex] || '';
    const notes = notesIndex >= 0 ? row[notesIndex]?.trim() : undefined;
    
    return {
      startValue: combineDateAndTime(startDateValue, startTime),
      endValue: combineDateAndTime(endDateValue, endTime),
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

export interface ValidationOptions {
  timezone?: string;
  customFormats?: string[];
}

export function validateAndConvertTimelogs(rows: TimelogRow[], options?: ValidationOptions): ValidationResult {
  const valid: ValidatedTimelog[] = [];
  const errors: string[] = [];
  const timezone = options?.timezone;
  const customFormats = options?.customFormats;

  for (const row of rows) {
    const startDate = parseDateTime(row.startValue, timezone, customFormats);
    const endDate = parseDateTime(row.endValue, timezone, customFormats);

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
      // Row has no end time — it is an active (running) timelog; skip silently
      if (!endDate && !row.endValue && startDate) continue;

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
  startDateColumn?: string;
  endDateColumn?: string;
  startTimeColumn: string;
  endTimeColumn: string;
  notesColumn?: string;
  timezone?: string;
  customFormats?: string[];
}

export interface ImportCSVResult {
  timelogs: ValidatedTimelog[];
  errors: string[];
  skippedCount: number;
  totalCount: number;
}

export function importTimelogsFromCSV(options: ImportCSVOptions): ImportCSVResult {
  const { csvText, startDateColumn, endDateColumn, startTimeColumn, endTimeColumn, notesColumn, timezone, customFormats } = options;
  
  // Parse CSV
  const parsed = parseCSV(csvText);
  
  // Process rows
  const rows = processTimelogRows({
    data: parsed.data,
    headers: parsed.headers,
    startDateColumn,
    endDateColumn,
    startTimeColumn,
    endTimeColumn,
    notesColumn,
  });
  
  // Validate and convert
  const result = validateAndConvertTimelogs(rows, { timezone, customFormats });
  
  return {
    timelogs: result.valid,
    errors: result.errors,
    skippedCount: parsed.data.length - result.valid.length,
    totalCount: parsed.data.length,
  };
}
