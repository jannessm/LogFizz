import { describe, it, expect } from 'vitest';
import {
  detectDelimiter,
  parseCSVLine,
  parseCSV,
  autoDetectColumns,
  combineDateAndTime,
  isValidDateTime,
  parseDateTime,
  processTimelogRows,
  validateAndConvertTimelogs,
  importTimelogsFromCSV,
} from './csvImport';

describe('csvImport utilities', () => {
  describe('detectDelimiter', () => {
    it('detects comma as delimiter', () => {
      expect(detectDelimiter('name,age,city')).toBe(',');
    });

    it('detects semicolon as delimiter', () => {
      expect(detectDelimiter('name;age;city')).toBe(';');
    });

    it('prefers semicolon when count is higher', () => {
      expect(detectDelimiter('name;age;city,country')).toBe(';');
    });
  });

  describe('parseCSVLine', () => {
    it('parses simple CSV line', () => {
      expect(parseCSVLine('a,b,c', ',')).toEqual(['a', 'b', 'c']);
    });

    it('handles quoted fields', () => {
      expect(parseCSVLine('a,"b,c",d', ',')).toEqual(['a', 'b,c', 'd']);
    });

    it('trims whitespace', () => {
      expect(parseCSVLine(' a , b , c ', ',')).toEqual(['a', 'b', 'c']);
    });

    it('handles semicolon delimiter', () => {
      expect(parseCSVLine('a;b;c', ';')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('parseCSV', () => {
    it('parses CSV with headers and data', () => {
      const csv = `Name,Age,City
John,30,NYC
Jane,25,LA`;
      const result = parseCSV(csv);
      expect(result.headers).toEqual(['Name', 'Age', 'City']);
      expect(result.data).toEqual([
        ['John', '30', 'NYC'],
        ['Jane', '25', 'LA'],
      ]);
      expect(result.delimiter).toBe(',');
    });

    it('parses CSV with semicolons', () => {
      const csv = `Date;Start time;End time
03.11.2025;08:00;14:36`;
      const result = parseCSV(csv);
      expect(result.headers).toEqual(['Date', 'Start time', 'End time']);
      expect(result.delimiter).toBe(';');
    });

    it('throws error for empty CSV', () => {
      expect(() => parseCSV('')).toThrow('at least a header row');
    });

    it('throws error for CSV with only headers', () => {
      expect(() => parseCSV('Name,Age')).toThrow('at least a header row');
    });
  });

  describe('autoDetectColumns', () => {
    it('detects start date column', () => {
      const result = autoDetectColumns(['Date', 'Time', 'Value']);
      expect(result.startDateColumn).toBe('Date');
    });

    it('detects start time column', () => {
      const result = autoDetectColumns(['Name', 'Start time', 'End time']);
      expect(result.startTimeColumn).toBe('Start time');
    });

    it('detects end time column', () => {
      const result = autoDetectColumns(['Name', 'Begin', 'End']);
      expect(result.endTimeColumn).toBe('End');
    });

    it('detects all columns including end date', () => {
      const result = autoDetectColumns(['Start Date', 'End Date', 'Start time', 'End time', 'Project']);
      expect(result.startDateColumn).toBe('Start Date');
      expect(result.endDateColumn).toBe('End Date');
      expect(result.startTimeColumn).toBe('Start time');
      expect(result.endTimeColumn).toBe('End time');
    });

    it('handles German column names', () => {
      const result = autoDetectColumns(['Datum', 'Anfang', 'Ende']);
      expect(result.startDateColumn).toBe('Datum');
      expect(result.startTimeColumn).toBe('Anfang');
      expect(result.endTimeColumn).toBe('Ende');
    });

    it('handles German date+time split columns (Start/Startzeit/Ende/Endzeit)', () => {
      const result = autoDetectColumns(['Projekt', 'Start', 'Startzeit', 'Ende', 'Endzeit', 'Notizen']);
      expect(result.startDateColumn).toBe('Start');
      expect(result.startTimeColumn).toBe('Startzeit');
      expect(result.endDateColumn).toBe('Ende');
      expect(result.endTimeColumn).toBe('Endzeit');
    });

    it('returns empty object when no columns match', () => {
      const result = autoDetectColumns(['Foo', 'Bar', 'Baz']);
      expect(result).toEqual({});
    });
  });

  describe('combineDateAndTime', () => {
    it('combines date and time', () => {
      expect(combineDateAndTime('2025-11-03', '08:00')).toBe('2025-11-03 08:00');
    });

    it('returns time when no date', () => {
      expect(combineDateAndTime('', '2025-11-03 08:00')).toBe('2025-11-03 08:00');
    });

    it('returns empty string when both empty', () => {
      expect(combineDateAndTime('', '')).toBe('');
    });

    it('returns empty string when no time', () => {
      expect(combineDateAndTime('2025-11-03', '')).toBe('');
    });

    it('trims whitespace', () => {
      expect(combineDateAndTime(' 2025-11-03 ', ' 08:00 ')).toBe('2025-11-03 08:00');
    });
  });

  describe('isValidDateTime', () => {
    it('validates ISO format', () => {
      expect(isValidDateTime('2025-11-03 08:00:00')).toBe(true);
    });

    it('validates German format', () => {
      expect(isValidDateTime('03.11.2025 08:00')).toBe(true);
    });

    it('validates US format', () => {
      expect(isValidDateTime('11/03/2025 08:00')).toBe(true);
    });

    it('rejects invalid dates', () => {
      expect(isValidDateTime('not a date')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidDateTime('')).toBe(false);
    });
  });

  describe('parseDateTime', () => {
    it('parses ISO format', () => {
      const result = parseDateTime('2025-11-03 08:00:00');
      expect(result).not.toBeNull();
      expect(result?.toISOString()).toContain('2025-11-03');
    });

    it('parses German format', () => {
      const result = parseDateTime('03.11.2025 08:00');
      expect(result).not.toBeNull();
      expect(result?.year()).toBe(2025);
      expect(result?.month()).toBe(10); // November is month 10 (0-indexed)
      expect(result?.date()).toBe(3);
    });

    it('returns null for invalid date', () => {
      expect(parseDateTime('invalid')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseDateTime('')).toBeNull();
    });
    
    it('parses custom format when provided', () => {
      const customFormat = 'DD-MM-YYYY HH:mm';
      const result = parseDateTime('15-01-2025 14:30', undefined, [customFormat]);
      expect(result).not.toBeNull();
      expect(result?.year()).toBe(2025);
      expect(result?.month()).toBe(0); // January is month 0
      expect(result?.date()).toBe(15);
      expect(result?.hour()).toBe(14);
      expect(result?.minute()).toBe(30);
    });
    
    it('tries custom formats before standard formats', () => {
      const customFormat = 'MM/DD/YYYY HH:mm'; // US format
      const result = parseDateTime('01/15/2025 14:30', undefined, [customFormat]);
      expect(result).not.toBeNull();
      expect(result?.month()).toBe(0); // January
      expect(result?.date()).toBe(15);
    });
    
    it('falls back to standard formats if custom format fails', () => {
      const customFormat = 'INVALID';
      const result = parseDateTime('2025-11-03 08:00:00', undefined, [customFormat]);
      expect(result).not.toBeNull();
      expect(result?.toISOString()).toContain('2025-11-03');
    });
  });

  describe('processTimelogRows', () => {
    it('processes rows with start date column', () => {
      const result = processTimelogRows({
        data: [
          ['03.11.2025', '08:00', '14:36'],
          ['04.11.2025', '08:00', '14:36'],
        ],
        headers: ['Date', 'Start time', 'End time'],
        startDateColumn: 'Date',
        startTimeColumn: 'Start time',
        endTimeColumn: 'End time',
      });

      expect(result).toHaveLength(2);
      expect(result[0].startValue).toBe('03.11.2025 08:00');
      expect(result[0].endValue).toBe('03.11.2025 14:36');
      expect(result[0].rowIndex).toBe(0);
    });

    it('processes rows with separate start and end date columns', () => {
      const result = processTimelogRows({
        data: [
          ['03.11.2025', '04.11.2025', '22:00', '02:00'],
        ],
        headers: ['Start Date', 'End Date', 'Start time', 'End time'],
        startDateColumn: 'Start Date',
        endDateColumn: 'End Date',
        startTimeColumn: 'Start time',
        endTimeColumn: 'End time',
      });

      expect(result).toHaveLength(1);
      expect(result[0].startValue).toBe('03.11.2025 22:00');
      expect(result[0].endValue).toBe('04.11.2025 02:00');
    });

    it('processes rows without date column', () => {
      const result = processTimelogRows({
        data: [
          ['2025-11-03 08:00', '2025-11-03 14:36'],
        ],
        headers: ['Start', 'End'],
        startTimeColumn: 'Start',
        endTimeColumn: 'End',
      });

      expect(result).toHaveLength(1);
      expect(result[0].startValue).toBe('2025-11-03 08:00');
      expect(result[0].endValue).toBe('2025-11-03 14:36');
    });

    it('throws error for invalid columns', () => {
      expect(() => processTimelogRows({
        data: [['value']],
        headers: ['Column'],
        startTimeColumn: 'NonExistent',
        endTimeColumn: 'AlsoNonExistent',
      })).toThrow('Start time and end time columns must be valid');
    });
  });

  describe('validateAndConvertTimelogs', () => {
    it('validates and converts valid timelogs', () => {
      const result = validateAndConvertTimelogs([
        { startValue: '2025-11-03 08:00', endValue: '2025-11-03 14:36', rowIndex: 0 },
        { startValue: '2025-11-04 08:00', endValue: '2025-11-04 14:36', rowIndex: 1 },
      ]);

      expect(result.valid).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.valid[0].start_timestamp).toContain('2025-11-03');
      expect(result.valid[0].end_timestamp).toContain('2025-11-03');
    });

    it('rejects when end is before start', () => {
      const result = validateAndConvertTimelogs([
        { startValue: '2025-11-03 14:00', endValue: '2025-11-03 08:00', rowIndex: 0 },
      ]);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('End time is before start time');
    });

    it('rejects invalid start time', () => {
      const result = validateAndConvertTimelogs([
        { startValue: 'invalid', endValue: '2025-11-03 14:00', rowIndex: 0 },
      ]);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toContain('Row 2: Invalid start time "invalid"');
    });

    it('rejects invalid end time', () => {
      const result = validateAndConvertTimelogs([
        { startValue: '2025-11-03 08:00', endValue: 'invalid', rowIndex: 0 },
      ]);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toContain('Row 2: Invalid end time "invalid"');
    });
  });

  describe('importTimelogsFromCSV', () => {
    it('imports complete CSV with start date column', () => {
      const csv = `Date;Start time;End time;Project
03.11.2025;08:00;14:36;HU
04.11.2025;08:00;14:36;HU`;

      const result = importTimelogsFromCSV({
        csvText: csv,
        startDateColumn: 'Date',
        startTimeColumn: 'Start time',
        endTimeColumn: 'End time',
      });

      expect(result.timelogs).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.skippedCount).toBe(0);
      expect(result.totalCount).toBe(2);
    });

    it('imports CSV with separate start and end date columns', () => {
      const csv = `Start Date;End Date;Start time;End time
03.11.2025;04.11.2025;22:00;02:00`;

      const result = importTimelogsFromCSV({
        csvText: csv,
        startDateColumn: 'Start Date',
        endDateColumn: 'End Date',
        startTimeColumn: 'Start time',
        endTimeColumn: 'End time',
      });

      expect(result.timelogs).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('imports CSV without date column', () => {
      const csv = `Start;End;Project
2025-11-03 08:00;2025-11-03 14:36;HU
2025-11-04 08:00;2025-11-04 14:36;HU`;

      const result = importTimelogsFromCSV({
        csvText: csv,
        startTimeColumn: 'Start',
        endTimeColumn: 'End',
      });

      expect(result.timelogs).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('handles mixed valid and invalid rows', () => {
      const csv = `Date;Start time;End time
03.11.2025;08:00;14:36
04.11.2025;invalid;14:36
05.11.2025;08:00;14:36`;

      const result = importTimelogsFromCSV({
        csvText: csv,
        startDateColumn: 'Date',
        startTimeColumn: 'Start time',
        endTimeColumn: 'End time',
      });

      expect(result.timelogs).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.skippedCount).toBe(1);
      expect(result.totalCount).toBe(3);
    });
  });
});
