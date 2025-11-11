import { describe, it, expect } from 'vitest';
import { calculateBreakTime } from '../utils/breaks';

describe('Break Time Calculation', () => {
  it('should return 0 minutes for less than 6 hours', () => {
    expect(calculateBreakTime(300)).toBe(0); // 5 hours
    expect(calculateBreakTime(359)).toBe(0); // 5 hours 59 minutes
  });

  it('should return 30 minutes for 6-9 hours', () => {
    expect(calculateBreakTime(360)).toBe(30); // 6 hours
    expect(calculateBreakTime(420)).toBe(30); // 7 hours
    expect(calculateBreakTime(480)).toBe(30); // 8 hours
    expect(calculateBreakTime(539)).toBe(30); // 8 hours 59 minutes
  });

  it('should return 45 minutes for 9+ hours', () => {
    expect(calculateBreakTime(540)).toBe(45); // 9 hours
    expect(calculateBreakTime(600)).toBe(45); // 10 hours
    expect(calculateBreakTime(720)).toBe(45); // 12 hours
  });

  it('should handle edge cases', () => {
    expect(calculateBreakTime(0)).toBe(0);
    expect(calculateBreakTime(359.9)).toBe(0);
    expect(calculateBreakTime(360.1)).toBe(30);
    expect(calculateBreakTime(539.9)).toBe(30);
    expect(calculateBreakTime(540.1)).toBe(45);
  });
});
