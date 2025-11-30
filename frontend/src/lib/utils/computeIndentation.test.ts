import { describe, it, expect } from 'vitest';
import { computeIndentation } from './computeIndentation';
import dayjs from 'dayjs';

describe('computeIndentation', () => {
  it('assigns level 0 for non-overlapping sessions', () => {
    const sessions = [
      { startTime: dayjs().hour(8).minute(0).format(), endTime: dayjs().hour(9).format() },
      { startTime: dayjs().hour(10).minute(0).format(), endTime: dayjs().hour(11).format() },
    ];

    const out = computeIndentation(sessions);
    expect(out).toHaveLength(2);
    expect(out[0].indentLevel).toBe(0);
    expect(out[1].indentLevel).toBe(0);
  });

  it('builds increasing indent levels for overlapping sessions', () => {
    // A: 09:00-11:00, B: 10:00-12:00, C: 10:30-11:30 -> levels 0,1,2
    const base = dayjs().startOf('day');
    const sessions = [
      { startTime: base.hour(9).minute(0).format(), endTime: base.hour(11).format() },
      { startTime: base.hour(10).minute(0).format(), endTime: base.hour(12).format() },
      { startTime: base.hour(10).minute(30).format(), endTime: base.hour(11).minute(30).format() },
    ];

    const out = computeIndentation(sessions);
    // Find sessions by startTime ordering
    expect(out[0].indentLevel).toBe(0);
    expect(out[1].indentLevel).toBe(1);
    expect(out[2].indentLevel).toBe(2);
  });

  it('reuses levels when possible (no overlap in level)', () => {
    // S1 08:00-09:00, S2 08:30-08:45 (overlaps with S1), S3 09:00-10:00 (should reuse level 0)
    const base = dayjs().startOf('day');
    const sessions = [
      { startTime: base.hour(8).minute(0).format(), endTime: base.hour(9).format() },
      { startTime: base.hour(8).minute(30).format(), endTime: base.hour(8).minute(45).format() },
      { startTime: base.hour(9).minute(0).format(), endTime: base.hour(10).format() },
    ];

    const out = computeIndentation(sessions);
    // first two will occupy level 0 and 1, third should go back to level 0
    const levels = out.map(s => s.indentLevel);
    expect(levels.sort()).toEqual([0,0,1].sort());
  });

  it('handles running sessions (no endTime) by using now as end', () => {
    const base = dayjs().startOf('day');
    const sessions = [
      { startTime: base.hour(8).format(), endTime: base.hour(9).format() },
      { startTime: base.hour(8).minute(30).format(), endTime: null },
    ];

    const out = computeIndentation(sessions);
    expect(out).toHaveLength(2);
    expect(out[0].indentLevel).toBe(0);
    expect(typeof out[1].indentLevel).toBe('number');
  });
});
