import { describe, it, expect, beforeEach } from 'vitest';
import { setDayjsLocale, formatDate, formatDateTime, formatTime, formatFullDate, formatMonthYear } from './dateFormatting';
import { dayjs } from '../types';

describe('dateFormatting', () => {
  describe('setDayjsLocale', () => {
    beforeEach(() => {
      // Reset to English before each test
      setDayjsLocale('en-US');
    });

    it('should set locale to en for en-US', () => {
      const result = setDayjsLocale('en-US');
      expect(result).toBe('en');
      expect(dayjs.locale()).toBe('en');
    });

    it('should set locale to en-gb for en-GB', () => {
      const result = setDayjsLocale('en-GB');
      expect(result).toBe('en-gb');
      expect(dayjs.locale()).toBe('en-gb');
    });

    it('should set locale to de for de-DE', () => {
      const result = setDayjsLocale('de-DE');
      expect(result).toBe('de');
      expect(dayjs.locale()).toBe('de');
    });

    it('should default to en for unknown locale', () => {
      const result = setDayjsLocale('fr-FR');
      expect(result).toBe('en');
      expect(dayjs.locale()).toBe('en');
    });
  });

  describe('formatDate', () => {
    it('should format date in English (US)', () => {
      setDayjsLocale('en-US');
      const date = '2025-01-15T10:30:00Z';
      const formatted = formatDate(date, 'L');
      expect(formatted).toMatch(/01\/15\/2025/);
    });

    it('should format date in English (GB)', () => {
      setDayjsLocale('en-GB');
      const date = '2025-01-15T10:30:00Z';
      const formatted = formatDate(date, 'L');
      expect(formatted).toMatch(/15\/01\/2025/);
    });

    it('should format date in German', () => {
      setDayjsLocale('de-DE');
      const date = '2025-01-15T10:30:00Z';
      const formatted = formatDate(date, 'L');
      expect(formatted).toMatch(/15\.01\.2025/);
    });
  });

  describe('formatMonthYear', () => {
    it('should format month and year in English', () => {
      setDayjsLocale('en-US');
      const date = '2025-01-15T10:30:00Z';
      const formatted = formatMonthYear(date);
      expect(formatted).toBe('January 2025');
    });

    it('should format month and year in German', () => {
      setDayjsLocale('de-DE');
      const date = '2025-01-15T10:30:00Z';
      const formatted = formatMonthYear(date);
      expect(formatted).toBe('Januar 2025');
    });
  });

  describe('formatFullDate', () => {
    it('should format full date with day name in English', () => {
      setDayjsLocale('en-US');
      const date = '2025-01-15T10:30:00Z';
      const formatted = formatFullDate(date);
      expect(formatted).toMatch(/Wednesday/);
      expect(formatted).toMatch(/January 15, 2025/);
    });

    it('should format full date with day name in German', () => {
      setDayjsLocale('de-DE');
      const date = '2025-01-15T10:30:00Z';
      const formatted = formatFullDate(date);
      expect(formatted).toMatch(/Mittwoch/);
      expect(formatted).toMatch(/15\. Januar 2025/);
    });
  });
});
