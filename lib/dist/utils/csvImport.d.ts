import dayjs from 'dayjs';
/**
 * Supported date/time formats for parsing
 */
export declare const DATE_TIME_FORMATS: string[];
/**
 * Column detection patterns
 */
export declare const COLUMN_PATTERNS: {
    readonly date: readonly ["date", "datum", "day", "tag"];
    readonly startTime: readonly ["start", "begin", "from", "anfang"];
    readonly endTime: readonly ["end", "stop", "to", "ende", "bis"];
    readonly notes: readonly ["note", "notes", "notiz", "notizen", "description", "beschreibung", "comment", "kommentar"];
};
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
export declare function detectDelimiter(line: string): ',' | ';';
/**
 * Parses a single CSV line, respecting quoted fields
 */
export declare function parseCSVLine(line: string, delimiter?: ',' | ';'): string[];
/**
 * Parses CSV text into headers and data rows
 */
export declare function parseCSV(text: string): ParsedCSV;
/**
 * Auto-detects date and time columns based on header names
 */
export declare function autoDetectColumns(headers: string[]): AutoDetectedColumns;
/**
 * Combines a date string with a time string
 * If no date is provided, returns the time as-is (assuming it contains the date)
 */
export declare function combineDateAndTime(date: string, time: string): string;
/**
 * Validates if a string is a valid date/time
 */
export declare function isValidDateTime(value: string): boolean;
/**
 * Parses a date/time string into a dayjs object
 * Returns null if the value cannot be parsed
 */
export declare function parseDateTime(value: string): dayjs.Dayjs | null;
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
export declare function processTimelogRows(options: ProcessRowsOptions): TimelogRow[];
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
export declare function validateAndConvertTimelogs(rows: TimelogRow[]): ValidationResult;
/**
 * Column detection patterns for project
 */
export declare const PROJECT_PATTERNS: string[];
/**
 * Detects the project column in CSV headers
 */
export declare function detectProjectColumn(headers: string[]): string | undefined;
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
export declare function detectProjectsInCSV(data: string[][], headers: string[], projectColumn: string): DetectedProject[];
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
export declare function importTimelogsFromCSV(options: ImportCSVOptions): ImportCSVResult;
//# sourceMappingURL=csvImport.d.ts.map