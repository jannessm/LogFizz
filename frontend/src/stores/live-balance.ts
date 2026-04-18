import { writable, derived, get } from 'svelte/store';
import { activeTimeLogs } from './timelogs';
import { balancesStore } from './balances';
import { timers } from './timers';
import { mapToArray } from './base-store';
import dayjs from '../../../lib/utils/dayjs.js';
import type { TimeLog, Timer } from '../types';

/**
 * Store that tracks whether any component is viewing balances
 * Components should call startBalanceUpdates() on mount and stopBalanceUpdates() on unmount
 */
const balanceViewers = writable<Set<string>>(new Set());
let updateInterval: number | null = null;

/**
 * Tick counter that increments every minute when there are active timelogs
 * Components can subscribe to this to trigger recalculations
 */
export const liveBalanceTick = writable<number>(0);

/**
 * Start the minute timer for live balance updates
 * @param componentId - Unique identifier for the component requesting updates
 */
export function startBalanceUpdates(componentId: string) {
  balanceViewers.update(viewers => {
    const newViewers = new Set(viewers);
    newViewers.add(componentId);
    
    // Start interval if this is the first viewer and there are active timelogs
    if (newViewers.size === 1) {
      startMinuteTimer();
    }
    
    return newViewers;
  });
}

/**
 * Stop the minute timer for a specific component
 * @param componentId - Unique identifier for the component stopping updates
 */
export function stopBalanceUpdates(componentId: string) {
  balanceViewers.update(viewers => {
    const newViewers = new Set(viewers);
    newViewers.delete(componentId);
    
    // Stop interval if no viewers remain
    if (newViewers.size === 0) {
      stopMinuteTimer();
    }
    
    return newViewers;
  });
}

/**
 * Start the minute interval timer
 * Only runs when there are both viewers and active timelogs
 */
function startMinuteTimer() {
  if (updateInterval !== null) {
    return; // Already running
  }

  const checkAndUpdate = async () => {
    const activeLogs = get(activeTimeLogs);
    const viewers = get(balanceViewers);
    
    // Only tick if we have both active timelogs and viewers
    if (activeLogs.length > 0 && viewers.size > 0) {
      liveBalanceTick.update(tick => tick + 1);
      
      // Recalculate today's daily balances when active timelogs are running
      await recalculateTodayBalances();
    } else if (activeLogs.length === 0) {
      // Stop timer if no active timelogs
      stopMinuteTimer();
    }
  };

  // Run immediately
  checkAndUpdate();
  
  // Then run every minute (60000ms)
  updateInterval = window.setInterval(checkAndUpdate, 60000);
}

/**
 * Stop the minute interval timer
 */
function stopMinuteTimer() {
  if (updateInterval !== null) {
    window.clearInterval(updateInterval);
    updateInterval = null;
  }
}

/**
 * Recalculate daily balances for today
 * Called automatically when live balance updates occur
 */
async function recalculateTodayBalances() {
  const today = dayjs().format('YYYY-MM-DD');
  const state = balancesStore.getState();
  
  // Find all targets that have a daily balance for today
  const todayBalances = mapToArray(state.items).filter(b => b.date === today);
  const targetIds = new Set(todayBalances.map(b => b.target_id));
  
  // Recalculate each target's daily balance
  for (const targetId of targetIds) {
    await balancesStore.recalculateDailyBalance(targetId, today);
  }
}

/**
 * Subscribe to active timelogs changes to start/stop timer
 */
activeTimeLogs.subscribe($activeTimeLogs => {
  const viewers = get(balanceViewers);
  
  if ($activeTimeLogs.length > 0 && viewers.size > 0) {
    // Start timer if we have active timelogs and viewers
    startMinuteTimer();
  } else if ($activeTimeLogs.length === 0) {
    // Stop timer if no active timelogs
    stopMinuteTimer();
  }
});

/**
 * Derived store that provides current elapsed minutes for active timelogs
 * Updates every minute automatically
 */
export const activeTimelogDurations = derived(
  [activeTimeLogs, liveBalanceTick],
  ([$activeTimeLogs, _tick]) => {
    const now = dayjs();

    return $activeTimeLogs.map(timelog => {
      const elapsedMinutes = now.diff(dayjs(timelog.start_timestamp), 'minute');

      return {
        ...timelog,
        elapsed_minutes: elapsedMinutes,
      };
    });
  }
);

// ---------------------------------------------------------------------------
// Shared live-balance utilities
// ---------------------------------------------------------------------------

/**
 * Calculate German-law break deduction (minutes) for a given elapsed duration.
 * ≥ 9 h → 45 min, ≥ 6 h → 30 min, otherwise 0.
 */
export function getBreakDeduction(elapsedMinutes: number): number {
  if (elapsedMinutes >= 9 * 60) return 45;
  if (elapsedMinutes >= 6 * 60) return 30;
  return 0;
}

/**
 * Compute how many minutes are currently being worked (for a specific target
 * on today) from active timelogs. The stored daily `worked_minutes` never
 * includes active (still-running) timelogs because `calculateTimelogDuration`
 * returns 0 when `end_timestamp` is absent, so we add the full elapsed time
 * without subtracting anything from the stored balance.
 *
 * Handles the multi-timelog day case correctly: completed timelogs are already
 * baked into `worked_minutes` by the normal balance calculation; this function
 * only sums the active (no `end_timestamp`) logs for the target.
 *
 * @param targetId - Target to compute active minutes for
 * @param allTimers - Full timers array (used to resolve timer → target)
 * @param activeLogs - Currently active (no end_timestamp) timelogs
 */
export function computeLiveExtraMinutes(
  targetId: string,
  allTimers: Timer[],
  activeLogs: TimeLog[],
): number {
  const linkedTimerIds = new Set(
    allTimers.filter(t => t.target_id === targetId).map(t => t.id)
  );
  const todayStr = dayjs().format('YYYY-MM-DD');
  const todayStart = dayjs().startOf('day').utc();
  const now = dayjs.utc();

  let activeMinutes = 0;
  for (const tl of activeLogs) {
    if (!linkedTimerIds.has(tl.timer_id)) continue;

    const startMoment = dayjs.utc(tl.start_timestamp);
    const logDate = startMoment.local().format('YYYY-MM-DD');
    // Skip timelogs not belonging to today or that haven't started yet
    if (logDate !== todayStr && startMoment.isAfter(now)) continue;

    let elapsed = now.diff(startMoment, 'minute');
    // Clip to today's start if the timelog began before midnight
    if (startMoment.isBefore(todayStart)) {
      elapsed = now.diff(todayStart, 'minute');
    }

    if (tl.apply_break_calculation) {
      const totalElapsed = now.diff(dayjs.utc(tl.start_timestamp), 'minute');
      elapsed = Math.max(0, elapsed - getBreakDeduction(totalElapsed));
    }

    activeMinutes += elapsed;
  }

  // The stored balance contributes 0 for active logs, so return full elapsed time
  return Math.max(0, activeMinutes);
}

/**
 * Derived store: maps `targetId → liveExtraMinutes` for today.
 *
 * Updated every time `liveBalanceTick` fires (≈ 1 min) or whenever
 * `activeTimeLogs` / `timers` / `dailyBalances` change.
 *
 * Both `BalancesOverview` and `OverallBalanceOverview` consume this store
 * so the live-update logic lives in a single place.
 */
export const liveExtraMinutesByTargetId = derived(
  [activeTimeLogs, timers, liveBalanceTick],
  ([$activeLogs, $timers, _tick]) => {
    const result = new Map<string, number>();

    if ($activeLogs.length === 0) return result;

    // Collect target IDs linked to any active timelog
    const activeTargetIds = new Set<string>();
    for (const tl of $activeLogs) {
      const timer = $timers.find(t => t.id === tl.timer_id);
      if (timer?.target_id) {
        activeTargetIds.add(timer.target_id);
      }
    }

    for (const targetId of activeTargetIds) {
      const extra = computeLiveExtraMinutes(targetId, $timers, $activeLogs);
      if (extra > 0) {
        result.set(targetId, extra);
      }
    }

    return result;
  }
);
