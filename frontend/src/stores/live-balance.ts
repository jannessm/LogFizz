import { writable, derived, get } from 'svelte/store';
import { activeTimeLogs } from './timelogs';
import { balancesStore } from './balances';
import { mapToArray } from './base-store';
import dayjs from '../../../lib/utils/dayjs.js';

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
