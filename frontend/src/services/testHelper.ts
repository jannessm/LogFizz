import type { TimeLog, Timer, Balance, TargetWithSpecs, TargetSpec, Holiday } from '../types';
import dayjs from '../../../lib/utils/dayjs.js';

// ============================================================================
// SEED DATA - Mirrors backend/src/scripts/seed.ts
// ============================================================================

// Demo user ID (would be generated on seed)
export const DEMO_USER_ID = 'demo-user-1';

// Target IDs
export const WORK_TARGET_ID = 'work-target-1';
export const STUDY_TARGET_ID = 'study-target-1';
export const EXERCISE_TARGET_ID = 'exercise-target-1';

// Timer IDs
export const WORK_TIMER_ID = 'work-timer-1';
export const STUDY_TIMER_ID = 'study-timer-1';
export const EXERCISE_TIMER_OLD_ID = 'exercise-timer-old-1';

// German holidays for Bavaria (DE-BY) and Baden-Württemberg (DE-BW)
// These would be fetched by the holiday crawler in seed.ts
const HOLIDAYS_DE_BY: Holiday[] = [
  // 2025 holidays
  { id: 'h1', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-01-01', name: "New Year's Day", localName: 'Neujahr', year: 2025 },
  { id: 'h2', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-01-06', name: 'Epiphany', localName: 'Heilige Drei Könige', year: 2025 },
  { id: 'h3', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-04-18', name: 'Good Friday', localName: 'Karfreitag', year: 2025 },
  { id: 'h4', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-04-21', name: 'Easter Monday', localName: 'Ostermontag', year: 2025 },
  { id: 'h5', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-05-01', name: 'Labour Day', localName: 'Tag der Arbeit', year: 2025 },
  { id: 'h6', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-05-29', name: 'Ascension Day', localName: 'Christi Himmelfahrt', year: 2025 },
  { id: 'h7', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-06-09', name: 'Whit Monday', localName: 'Pfingstmontag', year: 2025 },
  { id: 'h8', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-06-19', name: 'Corpus Christi', localName: 'Fronleichnam', year: 2025 },
  { id: 'h9', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-08-15', name: 'Assumption Day', localName: 'Mariä Himmelfahrt', year: 2025 },
  { id: 'h10', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-10-03', name: 'German Unity Day', localName: 'Tag der Deutschen Einheit', year: 2025 },
  { id: 'h11', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-11-01', name: "All Saints' Day", localName: 'Allerheiligen', year: 2025 },
  { id: 'h12', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-12-25', name: 'Christmas Day', localName: '1. Weihnachtstag', year: 2025 },
  { id: 'h13', country: 'DE', global: false, counties: ['DE-BY'], date: '2025-12-26', name: "St. Stephen's Day", localName: '2. Weihnachtstag', year: 2025 },
  // 2026 holidays
  { id: 'h14', country: 'DE', global: false, counties: ['DE-BY'], date: '2026-01-01', name: "New Year's Day", localName: 'Neujahr', year: 2026 },
  { id: 'h15', country: 'DE', global: false, counties: ['DE-BY'], date: '2026-01-06', name: 'Epiphany', localName: 'Heilige Drei Könige', year: 2026 },
];

const HOLIDAYS_DE_BW: Holiday[] = [
  // December 2025 - Baden-Württemberg
  { id: 'bw1', country: 'DE', global: false, counties: ['DE-BW'], date: '2025-12-25', name: 'Christmas Day', localName: '1. Weihnachtstag', year: 2025 },
  { id: 'bw2', country: 'DE', global: false, counties: ['DE-BW'], date: '2025-12-26', name: "St. Stephen's Day", localName: '2. Weihnachtstag', year: 2025 },
];

/**
 * Create seed targets matching backend/src/scripts/seed.ts
 */
export function createSeedTargets(): TargetWithSpecs[] {
  // Work Target with 3 specs
  const workTarget: TargetWithSpecs = {
    id: WORK_TARGET_ID,
    user_id: DEMO_USER_ID,
    name: 'Work Target',
    target_specs: [
      // Oldest spec: October-November 2025 (8h workdays, no holidays)
      {
        id: 'work-spec-old',
        user_id: DEMO_USER_ID,
        target_id: WORK_TARGET_ID,
        duration_minutes: [0, 480, 480, 480, 480, 480, 0], // Sun-Sat: 0, 8h, 8h, 8h, 8h, 8h, 0
        starting_from: '2025-10-01T00:00:00.000Z',
        ending_at: '2025-11-30T00:00:00.000Z',
        exclude_holidays: false,
      },
      // Middle spec: December 2025 (7h workdays, DE-BW holidays)
      {
        id: 'work-spec-middle',
        user_id: DEMO_USER_ID,
        target_id: WORK_TARGET_ID,
        duration_minutes: [0, 420, 420, 420, 420, 420, 0], // Sun-Sat: 0, 7h, 7h, 7h, 7h, 7h, 0
        starting_from: '2025-12-01T00:00:00.000Z',
        ending_at: '2025-12-31T00:00:00.000Z',
        exclude_holidays: true,
        state_code: 'DE-BW',
      },
      // Current spec: January 2026+ (8h workdays, DE-BY holidays)
      {
        id: 'work-spec-current',
        user_id: DEMO_USER_ID,
        target_id: WORK_TARGET_ID,
        duration_minutes: [0, 480, 480, 480, 480, 480, 0], // Sun-Sat: 0, 8h, 8h, 8h, 8h, 8h, 0
        starting_from: '2026-01-01T00:00:00.000Z',
        exclude_holidays: true,
        state_code: 'DE-BY',
      },
    ],
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  };

  // Study Target starting November 2025
  const studyTarget: TargetWithSpecs = {
    id: STUDY_TARGET_ID,
    user_id: DEMO_USER_ID,
    name: 'Study Target',
    target_specs: [
      {
        id: 'study-spec',
        user_id: DEMO_USER_ID,
        target_id: STUDY_TARGET_ID,
        duration_minutes: [0, 0, 120, 0, 120, 0, 0], // Sun-Sat: 0, 0, 2h, 0, 2h, 0, 0 (Tue/Thu)
        starting_from: '2025-11-01T00:00:00.000Z',
        exclude_holidays: false,
      },
    ],
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  };

  // Exercise Target (Ended) - September to October 2025
  const exerciseTarget: TargetWithSpecs = {
    id: EXERCISE_TARGET_ID,
    user_id: DEMO_USER_ID,
    name: 'Exercise Target (Ended)',
    target_specs: [
      {
        id: 'exercise-spec',
        user_id: DEMO_USER_ID,
        target_id: EXERCISE_TARGET_ID,
        duration_minutes: [0, 60, 0, 60, 0, 60, 0], // Sun-Sat: 0, 1h, 0, 1h, 0, 1h, 0 (Mon/Wed/Fri)
        starting_from: '2025-09-01T00:00:00.000Z',
        ending_at: '2025-10-31T00:00:00.000Z',
        exclude_holidays: false,
      },
    ],
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  };

  return [workTarget, studyTarget, exerciseTarget];
}

/**
 * Create seed timers matching backend/src/scripts/seed.ts
 */
export function createSeedTimers(): Timer[] {
  return [
    {
      id: WORK_TIMER_ID,
      user_id: DEMO_USER_ID,
      name: 'Work',
      emoji: '💼',
      color: '#3B82F6',
      target_id: WORK_TARGET_ID,
      auto_subtract_breaks: true,
      archived: false,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    },
    {
      id: STUDY_TIMER_ID,
      user_id: DEMO_USER_ID,
      name: 'Study',
      emoji: '📚',
      color: '#10B981',
      target_id: STUDY_TARGET_ID,
      auto_subtract_breaks: false,
      archived: false,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    },
    {
      id: EXERCISE_TIMER_OLD_ID,
      user_id: DEMO_USER_ID,
      name: 'Old Exercise',
      emoji: '🏋️',
      color: '#EC4899',
      target_id: EXERCISE_TARGET_ID,
      auto_subtract_breaks: false,
      archived: true,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    },
  ];
}

/**
 * Create seed timelogs for September 2025 exercise sessions
 * Exercise on Mon, Wed, Fri - 1 hour each
 */
export function createSeptember2025ExerciseLogs(): TimeLog[] {
  const logs: TimeLog[] = [];
  
  for (let day = 1; day <= 30; day++) {
    const date = dayjs.utc(`2025-09-${day.toString().padStart(2, '0')}`);
    const dayOfWeek = date.day();
    
    // Exercise on Mon (1), Wed (3), Fri (5)
    if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
      logs.push({
        id: `sep-exercise-${day}`,
        user_id: DEMO_USER_ID,
        timer_id: EXERCISE_TIMER_OLD_ID,
        type: 'normal',
        whole_day: false,
        start_timestamp: `2025-09-${day.toString().padStart(2, '0')}T07:00:00.000Z`,
        end_timestamp: `2025-09-${day.toString().padStart(2, '0')}T08:00:00.000Z`,
        duration_minutes: 60,
        timezone: 'Europe/Berlin',
        apply_break_calculation: false,
        notes: 'Morning exercise',
        created_at: `2025-09-${day.toString().padStart(2, '0')}T08:00:00.000Z`,
        updated_at: `2025-09-${day.toString().padStart(2, '0')}T08:00:00.000Z`,
        year: 2025,
        month: 9,
      });
    }
  }
  
  return logs;
}

/**
 * Create seed timelogs for October 2025
 * Work: 8 hours each weekday (9:00 AM - 5:00 PM)
 * Exercise: 1 hour on Mon, Wed, Fri
 */
export function createOctober2025Logs(): TimeLog[] {
  const logs: TimeLog[] = [];
  
  for (let day = 1; day <= 31; day++) {
    const date = dayjs.utc(`2025-10-${day.toString().padStart(2, '0')}`);
    const dayOfWeek = date.day();
    
    // Skip weekends for work
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Work session: 9:00 AM - 5:00 PM (8 hours)
      // With auto_subtract_breaks=true, 8h work = 8h - 30min break = 450 min effective
      logs.push({
        id: `oct-work-${day}`,
        user_id: DEMO_USER_ID,
        timer_id: WORK_TIMER_ID,
        type: 'normal',
        whole_day: false,
        start_timestamp: `2025-10-${day.toString().padStart(2, '0')}T09:00:00.000Z`,
        end_timestamp: `2025-10-${day.toString().padStart(2, '0')}T17:00:00.000Z`,
        duration_minutes: 450, // 8h - 30min break
        timezone: 'Europe/Berlin',
        apply_break_calculation: true,
        notes: 'October work session',
        created_at: `2025-10-${day.toString().padStart(2, '0')}T17:00:00.000Z`,
        updated_at: `2025-10-${day.toString().padStart(2, '0')}T17:00:00.000Z`,
        year: 2025,
        month: 10,
      });
    }
    
    // Exercise on Mon (1), Wed (3), Fri (5)
    if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
      logs.push({
        id: `oct-exercise-${day}`,
        user_id: DEMO_USER_ID,
        timer_id: EXERCISE_TIMER_OLD_ID,
        type: 'normal',
        whole_day: false,
        start_timestamp: `2025-10-${day.toString().padStart(2, '0')}T07:00:00.000Z`,
        end_timestamp: `2025-10-${day.toString().padStart(2, '0')}T08:00:00.000Z`,
        duration_minutes: 60,
        timezone: 'Europe/Berlin',
        apply_break_calculation: false,
        notes: 'Morning exercise (last month)',
        created_at: `2025-10-${day.toString().padStart(2, '0')}T08:00:00.000Z`,
        updated_at: `2025-10-${day.toString().padStart(2, '0')}T08:00:00.000Z`,
        year: 2025,
        month: 10,
      });
    }
  }
  
  return logs;
}

/**
 * Create seed timelogs for November 2025 (first 23 days)
 * Work: 8.5 hours each weekday (9:00 AM - 5:30 PM) = 30 min overtime
 * Study: 2 hours on Tue/Thu
 */
export function createNovember2025Logs(): TimeLog[] {
  const logs: TimeLog[] = [];
  
  for (let day = 1; day <= 23; day++) {
    const date = dayjs.utc(`2025-11-${day.toString().padStart(2, '0')}`);
    const dayOfWeek = date.day();
    
    // Skip weekends for work
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Work session: 9:00 AM - 5:30 PM (8.5 hours)
      // With auto_subtract_breaks=true, 8.5h work = 510min - 30min break = 480 min effective
      logs.push({
        id: `nov-work-${day}`,
        user_id: DEMO_USER_ID,
        timer_id: WORK_TIMER_ID,
        type: 'normal',
        whole_day: false,
        start_timestamp: `2025-11-${day.toString().padStart(2, '0')}T09:00:00.000Z`,
        end_timestamp: `2025-11-${day.toString().padStart(2, '0')}T17:30:00.000Z`,
        duration_minutes: 480, // 8.5h - 30min break = 480 min
        timezone: 'Europe/Berlin',
        apply_break_calculation: true,
        notes: 'November work session',
        created_at: `2025-11-${day.toString().padStart(2, '0')}T17:30:00.000Z`,
        updated_at: `2025-11-${day.toString().padStart(2, '0')}T17:30:00.000Z`,
        year: 2025,
        month: 11,
      });
      
      // Study sessions on Tue (2) & Thu (4)
      if (dayOfWeek === 2 || dayOfWeek === 4) {
        logs.push({
          id: `nov-study-${day}`,
          user_id: DEMO_USER_ID,
          timer_id: STUDY_TIMER_ID,
          type: 'normal',
          whole_day: false,
          start_timestamp: `2025-11-${day.toString().padStart(2, '0')}T19:00:00.000Z`,
          end_timestamp: `2025-11-${day.toString().padStart(2, '0')}T21:00:00.000Z`,
          duration_minutes: 120,
          timezone: 'Europe/Berlin',
          apply_break_calculation: false,
          notes: 'November study session',
          created_at: `2025-11-${day.toString().padStart(2, '0')}T21:00:00.000Z`,
          updated_at: `2025-11-${day.toString().padStart(2, '0')}T21:00:00.000Z`,
          year: 2025,
          month: 11,
        });
      }
    }
  }
  
  return logs;
}

/**
 * Get all seed timelogs
 */
export function getAllSeedTimelogs(): TimeLog[] {
  return [
    ...createSeptember2025ExerciseLogs(),
    ...createOctober2025Logs(),
    ...createNovember2025Logs(),
  ];
}

/**
 * Filter timelogs for a specific timer
 */
export function getTimelogsForTimer(timelogs: TimeLog[], timerId: string): TimeLog[] {
  return timelogs.filter(tl => tl.timer_id === timerId);
}

/**
 * Filter timelogs for a specific date
 */
export function getTimelogsForDate(timelogs: TimeLog[], date: string): TimeLog[] {
  return timelogs.filter(tl => {
    const logDate = dayjs(tl.start_timestamp).format('YYYY-MM-DD');
    return logDate === date;
  });
}

/**
 * Get holidays map for a specific state (keyed by state_code → Set<date>)
 * Mirrors the Map<string, Set<string>> format expected by calculateDueMinutes
 */
export function getHolidaysSet(stateCode: string, year: number, month: number): Map<string, Set<string>> {
  const holidays = stateCode === 'DE-BY' ? HOLIDAYS_DE_BY : HOLIDAYS_DE_BW;
  const filtered = holidays.filter(h => {
    const hDate = dayjs(h.date);
    return hDate.year() === year && hDate.month() + 1 === month;
  });
  return new Map([[stateCode, new Set(filtered.map(h => h.date))]]);
}