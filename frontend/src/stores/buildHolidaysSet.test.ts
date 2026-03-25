import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TargetWithSpecs, TargetSpec } from '../types';

// ── Mock all modules that balances.ts pulls in at module-level ────────────────

vi.mock('../lib/db', () => ({
  getAllBalances: vi.fn().mockResolvedValue([]),
  saveBalance: vi.fn(),
  deleteBalance: vi.fn(),
  getBalancesByDate: vi.fn(),
  getBalancesByTargetId: vi.fn(),
  getTimeLogsByYearMonth: vi.fn().mockResolvedValue([]),
  getBalance: vi.fn(),
  getBalanceCalcMeta: vi.fn().mockResolvedValue(null),
  setBalanceCalcMetaForTarget: vi.fn().mockResolvedValue(undefined),
  clearBalanceCalcMeta: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/sync', () => ({
  syncService: {
    queueUpsertBalance: vi.fn(),
    queueDeleteBalance: vi.fn(),
    sync: vi.fn(),
  },
}));

vi.mock('./timers', () => ({
  timers: { subscribe: vi.fn((cb) => { cb([]); return () => {}; }) },
}));

vi.mock('./targets', () => ({
  targets: { subscribe: vi.fn((cb) => { cb([]); return () => {}; }) },
  targetsStore: { getTargetsByTimerIds: vi.fn(async () => []) },
}));

// Keep a mutable reference so individual tests can swap the return value
let holidaysMock: (stateCode: string, year: number, month: number) => { date: string }[];
holidaysMock = () => [];

vi.mock('./holidays', () => ({
  holidaysStore: {
    getHolidaysForMonth: vi.fn(
      (stateCode: string, year: number, month: number) =>
        holidaysMock(stateCode, year, month)
    ),
    fetchHolidaysForStates: vi.fn(),
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { buildHolidaysSet } from './balances';
import { holidaysStore } from './holidays';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSpec(overrides: Partial<TargetSpec> = {}): TargetSpec {
  return {
    id: 'spec-1',
    user_id: 'user-1',
    target_id: 'target-1',
    starting_from: '2024-01-01',
    ending_at: undefined,
    duration_minutes: [0, 480, 480, 480, 480, 480, 0],
    exclude_holidays: false,
    state_code: undefined,
    ...overrides,
  };
}

function makeTarget(specs: TargetSpec[]): TargetWithSpecs {
  return {
    id: 'target-1',
    user_id: 'user-1',
    name: 'Test Target',
    target_specs: specs,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildHolidaysSet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holidaysMock = () => [];
  });

  it('returns an empty set when the target has no specs', () => {
    const target = makeTarget([]);
    const result = buildHolidaysSet(target, 2024, 12);
    expect(result.size).toBe(0);
    expect(holidaysStore.getHolidaysForMonth).not.toHaveBeenCalled();
  });

  it('returns an empty set when no spec has exclude_holidays enabled', () => {
    const target = makeTarget([
      makeSpec({ exclude_holidays: false, state_code: 'DE-BY' }),
    ]);
    const result = buildHolidaysSet(target, 2024, 12);
    expect(result.size).toBe(0);
    expect(holidaysStore.getHolidaysForMonth).not.toHaveBeenCalled();
  });

  it('returns an empty set when exclude_holidays is true but state_code is missing', () => {
    const target = makeTarget([
      makeSpec({ exclude_holidays: true, state_code: undefined }),
    ]);
    const result = buildHolidaysSet(target, 2024, 12);
    expect(result.size).toBe(0);
    expect(holidaysStore.getHolidaysForMonth).not.toHaveBeenCalled();
  });

  it('queries the store with the full state_code (not just the country prefix)', () => {
    const target = makeTarget([
      makeSpec({ exclude_holidays: true, state_code: 'DE-BY' }),
    ]);
    buildHolidaysSet(target, 2024, 12);
    expect(holidaysStore.getHolidaysForMonth).toHaveBeenCalledWith('DE-BY', 2024, 12);
    // Must NOT strip to 'DE'
    expect(holidaysStore.getHolidaysForMonth).not.toHaveBeenCalledWith('DE', 2024, 12);
  });

  it('forwards the given year and month to the store', () => {
    const target = makeTarget([
      makeSpec({ exclude_holidays: true, state_code: 'DE-BW' }),
    ]);
    buildHolidaysSet(target, 2025, 6);
    expect(holidaysStore.getHolidaysForMonth).toHaveBeenCalledWith('DE-BW', 2025, 6);
  });

  it('returns holiday dates returned by the store', () => {
    holidaysMock = () => [
      { date: '2024-12-25' },
      { date: '2024-12-26' },
    ];
    const target = makeTarget([
      makeSpec({ exclude_holidays: true, state_code: 'DE-BY' }),
    ]);
    const result = buildHolidaysSet(target, 2024, 12);
    expect(result).toEqual(new Set(['2024-12-25', '2024-12-26']));
  });

  it('returns an empty set when the store returns no holidays', () => {
    holidaysMock = () => [];
    const target = makeTarget([
      makeSpec({ exclude_holidays: true, state_code: 'DE-BY' }),
    ]);
    const result = buildHolidaysSet(target, 2024, 12);
    expect(result.size).toBe(0);
  });

  it('merges holidays from multiple specs with different state codes', () => {
    holidaysMock = (stateCode) => {
      if (stateCode === 'DE-BY') return [{ date: '2024-12-25' }, { date: '2024-12-26' }];
      if (stateCode === 'DE-BW') return [{ date: '2024-12-26' }, { date: '2024-12-31' }];
      return [];
    };
    const target = makeTarget([
      makeSpec({ id: 'spec-1', exclude_holidays: true, state_code: 'DE-BY' }),
      makeSpec({ id: 'spec-2', exclude_holidays: true, state_code: 'DE-BW' }),
    ]);
    const result = buildHolidaysSet(target, 2024, 12);
    // Duplicates are de-duped by the Set
    expect(result).toEqual(new Set(['2024-12-25', '2024-12-26', '2024-12-31']));
    expect(holidaysStore.getHolidaysForMonth).toHaveBeenCalledTimes(2);
  });

  it('skips specs without exclude_holidays even when other specs are active', () => {
    holidaysMock = (stateCode) =>
      stateCode === 'DE-BY' ? [{ date: '2024-12-25' }] : [];

    const target = makeTarget([
      makeSpec({ id: 'spec-1', exclude_holidays: false, state_code: 'DE-BY' }), // should be ignored
      makeSpec({ id: 'spec-2', exclude_holidays: true,  state_code: 'DE-BW' }), // should be queried
    ]);
    buildHolidaysSet(target, 2024, 12);
    expect(holidaysStore.getHolidaysForMonth).toHaveBeenCalledTimes(1);
    expect(holidaysStore.getHolidaysForMonth).toHaveBeenCalledWith('DE-BW', 2024, 12);
  });

  it('returns a new Set instance on every call', () => {
    const target = makeTarget([
      makeSpec({ exclude_holidays: true, state_code: 'DE-BY' }),
    ]);
    const a = buildHolidaysSet(target, 2024, 12);
    const b = buildHolidaysSet(target, 2024, 12);
    expect(a).not.toBe(b);
  });
});
