import { describe, it, expect } from 'vitest';
import { getTypeColor } from './calendar';
import { dayjs } from '../types';
import type { TimeLog } from '../types';

describe('Calendar Service', () => {
  describe('getTypeColor', () => {
    it('should return correct colors for special types', () => {
      expect(getTypeColor('sick')).toBe('#EF4444');
      expect(getTypeColor('holiday')).toBe('#10B981');
      expect(getTypeColor('business-trip')).toBe('#F59E0B');
      expect(getTypeColor('child-sick')).toBe('#EC4899');
      expect(getTypeColor('normal')).toBeNull();
    });
  });

  describe('getMultiDayRange - single range', () => {
    it('should return no range for normal type', () => {
      const timeLogs: TimeLog[] = [
        {
          id: 'log1',
          timer_id: 'timer1',
          type: 'normal',
          start_timestamp: '2026-01-01T09:00:00Z',
          end_timestamp: '2026-01-03T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
      ];

      const result = getMultiDayRange(dayjs('2026-01-02'), timeLogs);
      expect(result.isInRange).toBe(false);
      expect(result.colors).toEqual([]);
    });

    it('should identify start of range', () => {
      const timeLogs: TimeLog[] = [
        {
          id: 'log1',
          timer_id: 'timer1',
          type: 'sick',
          start_timestamp: '2026-01-01T09:00:00Z',
          end_timestamp: '2026-01-03T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
      ];

      const result = getMultiDayRange(dayjs('2026-01-01'), timeLogs);
      expect(result.isInRange).toBe(true);
      expect(result.isStart).toBe(true);
      expect(result.isEnd).toBe(false);
      expect(result.isMiddle).toBe(false);
      expect(result.colors).toEqual(['#EF4444']);
    });

    it('should identify middle of range', () => {
      const timeLogs: TimeLog[] = [
        {
          id: 'log1',
          timer_id: 'timer1',
          type: 'sick',
          start_timestamp: '2026-01-01T09:00:00Z',
          end_timestamp: '2026-01-03T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
      ];

      const result = getMultiDayRange(dayjs('2026-01-02'), timeLogs);
      expect(result.isInRange).toBe(true);
      expect(result.isStart).toBe(false);
      expect(result.isEnd).toBe(false);
      expect(result.isMiddle).toBe(true);
      expect(result.colors).toEqual(['#EF4444']);
    });

    it('should identify end of range', () => {
      const timeLogs: TimeLog[] = [
        {
          id: 'log1',
          timer_id: 'timer1',
          type: 'sick',
          start_timestamp: '2026-01-01T09:00:00Z',
          end_timestamp: '2026-01-03T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
      ];

      const result = getMultiDayRange(dayjs('2026-01-03'), timeLogs);
      expect(result.isInRange).toBe(true);
      expect(result.isStart).toBe(false);
      expect(result.isEnd).toBe(true);
      expect(result.isMiddle).toBe(false);
      expect(result.colors).toEqual(['#EF4444']);
    });

    it('should return no range for single day timelog', () => {
      const timeLogs: TimeLog[] = [
        {
          id: 'log1',
          timer_id: 'timer1',
          type: 'sick',
          start_timestamp: '2026-01-01T09:00:00Z',
          end_timestamp: '2026-01-01T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
      ];

      const result = getMultiDayRange(dayjs('2026-01-01'), timeLogs);
      expect(result.isInRange).toBe(false);
      expect(result.colors).toEqual([]);
    });
  });

  describe('getMultiDayRange - multiple overlapping ranges', () => {
    it('should handle two ranges starting on same day (treat as middle)', () => {
      const timeLogs: TimeLog[] = [
        {
          id: 'log1',
          timer_id: 'timer1',
          type: 'sick',
          start_timestamp: '2026-01-01T09:00:00Z',
          end_timestamp: '2026-01-03T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
        {
          id: 'log2',
          timer_id: 'timer2',
          type: 'holiday',
          start_timestamp: '2026-01-01T09:00:00Z',
          end_timestamp: '2026-01-05T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
      ];

      const result = getMultiDayRange(dayjs('2026-01-01'), timeLogs);
      expect(result.isInRange).toBe(true);
      expect(result.isStart).toBe(false);
      expect(result.isEnd).toBe(false);
      expect(result.isMiddle).toBe(true); // Overlapping starts = middle for blending
      expect(result.colors).toEqual(['#EF4444', '#10B981']);
    });

    it('should handle two ranges ending on same day (treat as middle)', () => {
      const timeLogs: TimeLog[] = [
        {
          id: 'log1',
          timer_id: 'timer1',
          type: 'sick',
          start_timestamp: '2026-01-01T09:00:00Z',
          end_timestamp: '2026-01-05T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
        {
          id: 'log2',
          timer_id: 'timer2',
          type: 'holiday',
          start_timestamp: '2026-01-03T09:00:00Z',
          end_timestamp: '2026-01-05T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
      ];

      const result = getMultiDayRange(dayjs('2026-01-05'), timeLogs);
      expect(result.isInRange).toBe(true);
      expect(result.isStart).toBe(false);
      expect(result.isEnd).toBe(false);
      expect(result.isMiddle).toBe(true); // Overlapping ends = middle for blending
      expect(result.colors).toEqual(['#EF4444', '#10B981']);
    });

    it('should collect all colors from overlapping ranges in middle', () => {
      const timeLogs: TimeLog[] = [
        {
          id: 'log1',
          timer_id: 'timer1',
          type: 'sick',
          start_timestamp: '2026-01-01T09:00:00Z',
          end_timestamp: '2026-01-05T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
        {
          id: 'log2',
          timer_id: 'timer2',
          type: 'holiday',
          start_timestamp: '2026-01-02T09:00:00Z',
          end_timestamp: '2026-01-04T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
        {
          id: 'log3',
          timer_id: 'timer3',
          type: 'business-trip',
          start_timestamp: '2026-01-01T09:00:00Z',
          end_timestamp: '2026-01-06T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
      ];

      const result = getMultiDayRange(dayjs('2026-01-03'), timeLogs);
      expect(result.isInRange).toBe(true);
      expect(result.isMiddle).toBe(true);
      expect(result.colors).toEqual(['#EF4444', '#10B981', '#F59E0B']);
    });

    it('should handle adjacent ranges (one ending where another starts)', () => {
      const timeLogs: TimeLog[] = [
        {
          id: 'log1',
          timer_id: 'timer1',
          type: 'sick',
          start_timestamp: '2026-01-01T09:00:00Z',
          end_timestamp: '2026-01-03T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
        {
          id: 'log2',
          timer_id: 'timer2',
          type: 'holiday',
          start_timestamp: '2026-01-03T09:00:00Z',
          end_timestamp: '2026-01-05T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
      ];

      // Jan 3 should be middle (blending point)
      const result = getMultiDayRange(dayjs('2026-01-03'), timeLogs);
      expect(result.isInRange).toBe(true);
      expect(result.isStart).toBe(false);
      expect(result.isEnd).toBe(false);
      expect(result.isMiddle).toBe(true);
      expect(result.colors).toEqual(['#EF4444', '#10B981']);
    });

    it('should handle non-overlapping ranges correctly', () => {
      const timeLogs: TimeLog[] = [
        {
          id: 'log1',
          timer_id: 'timer1',
          type: 'sick',
          start_timestamp: '2026-01-01T09:00:00Z',
          end_timestamp: '2026-01-03T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
        {
          id: 'log2',
          timer_id: 'timer2',
          type: 'holiday',
          start_timestamp: '2026-01-10T09:00:00Z',
          end_timestamp: '2026-01-12T17:00:00Z',
          timezone: 'UTC',
        } as TimeLog,
      ];

      // Jan 2 should only have sick
      const result = getMultiDayRange(dayjs('2026-01-02'), timeLogs);
      expect(result.isInRange).toBe(true);
      expect(result.isMiddle).toBe(true);
      expect(result.colors).toEqual(['#EF4444']);
    });
  });
});
