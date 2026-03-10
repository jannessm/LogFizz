import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setDayjsLocale, formatDate, formatDateTime, formatTime, formatFullDate, formatMonthYear, getDayAbbreviation, getDayAbbreviations, uses12HourClock } from './dateFormatting';
import { dayjs } from '../types';
import { userSettingsStore } from '../stores/userSettings';

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

  describe('getDayAbbreviation', () => {
    it('should return English day abbreviations when language is en', () => {
      expect(getDayAbbreviation(0, 'en')).toBe('Sun');
      expect(getDayAbbreviation(1, 'en')).toBe('Mon');
      expect(getDayAbbreviation(2, 'en')).toBe('Tue');
      expect(getDayAbbreviation(3, 'en')).toBe('Wed');
      expect(getDayAbbreviation(4, 'en')).toBe('Thu');
      expect(getDayAbbreviation(5, 'en')).toBe('Fri');
      expect(getDayAbbreviation(6, 'en')).toBe('Sat');
    });

    it('should return German day abbreviations when language is de', () => {
      expect(getDayAbbreviation(0, 'de')).toBe('So.');
      expect(getDayAbbreviation(1, 'de')).toBe('Mo.');
      expect(getDayAbbreviation(2, 'de')).toBe('Di.');
      expect(getDayAbbreviation(3, 'de')).toBe('Mi.');
      expect(getDayAbbreviation(4, 'de')).toBe('Do.');
      expect(getDayAbbreviation(5, 'de')).toBe('Fr.');
      expect(getDayAbbreviation(6, 'de')).toBe('Sa.');
    });

    it('should use user settings language when no language parameter provided', () => {
      // Mock userSettingsStore to return 'de'
      vi.spyOn(userSettingsStore, 'getLanguage').mockReturnValue('de');
      expect(getDayAbbreviation(0)).toBe('So.');
      expect(getDayAbbreviation(1)).toBe('Mo.');
    });

    it('should not be affected by global dayjs locale setting', () => {
      // Set global locale to German
      setDayjsLocale('de-DE');
      
      // But request English day names - should get English regardless of global locale
      expect(getDayAbbreviation(0, 'en')).toBe('Sun');
      expect(getDayAbbreviation(1, 'en')).toBe('Mon');
      
      // And German when requested
      expect(getDayAbbreviation(0, 'de')).toBe('So.');
      expect(getDayAbbreviation(1, 'de')).toBe('Mo.');
    });
  });

  describe('getDayAbbreviations', () => {
    it('should return all English day abbreviations', () => {
      const days = getDayAbbreviations('en');
      expect(days).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    });

    it('should return all German day abbreviations', () => {
      const days = getDayAbbreviations('de');
      expect(days).toEqual(['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.']);
    });

    it('should use user settings language when no language parameter provided', () => {
      // Mock userSettingsStore to return 'en'
      vi.spyOn(userSettingsStore, 'getLanguage').mockReturnValue('en');
      const days = getDayAbbreviations();
      expect(days).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    });
  });

  describe('uses12HourClock', () => {
    it('should return true for en-US (12-hour clock)', () => {
      setDayjsLocale('en-US');
      expect(uses12HourClock()).toBe(true);
    });

    it('should return false for en-GB (24-hour clock)', () => {
      setDayjsLocale('en-GB');
      expect(uses12HourClock()).toBe(false);
    });

    it('should return false for de-DE (24-hour clock)', () => {
      setDayjsLocale('de-DE');
      expect(uses12HourClock()).toBe(false);
    });
  });
});
