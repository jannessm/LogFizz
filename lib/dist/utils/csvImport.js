import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);
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
};
/**
 * Detects the delimiter used in a CSV line
 * Prefers comma, falls back to semicolon
 */
export function detectDelimiter(line) {
    const commaCount = (line.match(/,/g) || []).length;
    const semicolonCount = (line.match(/;/g) || []).length;
    return semicolonCount > commaCount ? ';' : ',';
}
/**
 * Parses a single CSV line, respecting quoted fields
 */
export function parseCSVLine(line, delimiter = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        }
        else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
        }
        else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}
/**
 * Parses CSV text into headers and data rows
 */
export function parseCSV(text) {
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
export function autoDetectColumns(headers) {
    const result = {};
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
    }
    return result;
}
/**
 * Combines a date string with a time string
 * If no date is provided, returns the time as-is (assuming it contains the date)
 */
export function combineDateAndTime(date, time) {
    if (!date && !time)
        return '';
    if (!date)
        return time; // If no date, treat time as full datetime
    if (!time)
        return '';
    // Combine date and time: "03.11.2025" + "08:00" -> "03.11.2025 08:00"
    return `${date.trim()} ${time.trim()}`;
}
/**
 * Validates if a string is a valid date/time
 */
export function isValidDateTime(value) {
    console.log('Validating date/time:', value, !value);
    if (!value)
        return false;
    // Try all known formats
    for (const format of DATE_TIME_FORMATS) {
        const parsed = dayjs(value, format, true);
        console.log(`Trying format ${format}:`, parsed);
        if (parsed.isValid())
            return true;
    }
    // Also try native Date parsing
    const date = new Date(value);
    return !isNaN(date.getTime());
}
/**
 * Parses a date/time string into a dayjs object
 * Returns null if the value cannot be parsed
 */
export function parseDateTime(value) {
    if (!value)
        return null;
    // Try all known formats
    for (const format of DATE_TIME_FORMATS) {
        const parsed = dayjs(value, format, true);
        if (parsed.isValid())
            return parsed;
    }
    // Try native Date parsing
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
        return dayjs(date);
    }
    return null;
}
export function processTimelogRows(options) {
    const { data, headers, dateColumn, startTimeColumn, endTimeColumn } = options;
    const dateIndex = dateColumn ? headers.indexOf(dateColumn) : -1;
    const startIndex = headers.indexOf(startTimeColumn);
    const endIndex = headers.indexOf(endTimeColumn);
    if (startIndex === -1 || endIndex === -1) {
        throw new Error('Start time and end time columns must be valid');
    }
    return data.map((row, index) => {
        const dateValue = dateIndex >= 0 ? row[dateIndex] || '' : '';
        const startTime = row[startIndex] || '';
        const endTime = row[endIndex] || '';
        return {
            startValue: combineDateAndTime(dateValue, startTime),
            endValue: combineDateAndTime(dateValue, endTime),
            rowIndex: index,
        };
    });
}
export function validateAndConvertTimelogs(rows) {
    const valid = [];
    const errors = [];
    for (const row of rows) {
        const startDate = parseDateTime(row.startValue);
        const endDate = parseDateTime(row.endValue);
        if (startDate && endDate) {
            if (endDate.isAfter(startDate)) {
                valid.push({
                    start_timestamp: startDate.toISOString(),
                    end_timestamp: endDate.toISOString(),
                });
            }
            else {
                errors.push(`Row ${row.rowIndex + 2}: End time is before start time`);
            }
        }
        else {
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
export function importTimelogsFromCSV(options) {
    const { csvText, dateColumn, startTimeColumn, endTimeColumn } = options;
    // Parse CSV
    const parsed = parseCSV(csvText);
    // Process rows
    const rows = processTimelogRows({
        data: parsed.data,
        headers: parsed.headers,
        dateColumn,
        startTimeColumn,
        endTimeColumn,
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
//# sourceMappingURL=csvImport.js.map