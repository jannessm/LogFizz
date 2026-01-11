import type { TargetWithSpecs, TimeLog } from '../types';
import { targetsStore } from '../stores/targets.js';
import { balancesStore } from '../stores/balances.js';

/**
 * Triggers balance recalculation for a timelog.
 * Uses the unified ensureBalancesUpToDate function which:
 * - Extends daily balances from last_updated_day to today (create only if missing)
 * - Recalculates affected days for the given timelog
 * - Rebuilds monthly and yearly balances with proper cumulative propagation
 * 
 * @param timelog - Timelog that was created/updated/deleted
 * @param targets - Optional array of targets to process (will be fetched if not provided)
 */
export async function recalculateBalancesForTimeLog(
  timelog: TimeLog,
  targets?: TargetWithSpecs[],
) {
  if (!targets) {
    targets = await targetsStore.getTargetsByTimerIds([timelog.timer_id]);
  }
  
  if (targets.length === 0) return;

  for (const target of targets) {
    await balancesStore.ensureBalancesUpToDate(target.id, timelog);
  }
}
