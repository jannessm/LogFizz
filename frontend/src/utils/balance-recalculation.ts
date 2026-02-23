import type { TargetWithSpecs, TimeLog } from '../types';
import { dayjs } from '../types';
import { targetsStore } from '../stores/targets.js';
import { balancesStore } from '../stores/balances.js';

/**
 * Triggers balance recalculation for a timelog.
 * Uses the unified ensureBalancesUpToDate function which:
 * - Extends daily balances from last_updated_day to today (create only if missing)
 * - Recalculates affected days for the given timelog
 * - Rebuilds monthly and yearly balances with proper cumulative propagation
 * 
 * When a previousTimelog is provided (e.g. on update), the affected range is the
 * union of the old and new timespans so that balances for days the timelog moved
 * away from are recalculated as well.
 * 
 * @param timelog - Timelog that was created/updated/deleted
 * @param targets - Optional array of targets to process (will be fetched if not provided)
 * @param previousTimelog - Optional previous version of the timelog (before update) to recalculate old date range
 */
export async function recalculateBalancesForTimeLog(
  timelog: TimeLog,
  targets?: TargetWithSpecs[],
  previousTimelog?: TimeLog,
) {
  if (!targets) {
    const timerIds = [timelog.timer_id];
    if (previousTimelog && previousTimelog.timer_id !== timelog.timer_id) {
      timerIds.push(previousTimelog.timer_id);
    }
    targets = await targetsStore.getTargetsByTimerIds(timerIds);
  }
  
  if (targets.length === 0) return;

  // Build a synthetic timelog whose timespan is the union of old and new ranges
  const effectiveTimelog = previousTimelog
    ? buildUnionTimelog(timelog, previousTimelog)
    : timelog;

  for (const target of targets) {
    await balancesStore.ensureBalancesUpToDate(target.id, effectiveTimelog);
  }
}

/**
 * Build a synthetic timelog whose start/end timestamps span the union of
 * two timelogs (the old and new version). This ensures that
 * ensureBalancesUpToDate recalculates every day that was affected by either
 * the old or new timespan.
 */
function buildUnionTimelog(current: TimeLog, previous: TimeLog): TimeLog {
  const starts = [
    dayjs(current.start_timestamp),
    dayjs(previous.start_timestamp),
  ];
  const ends = [
    current.end_timestamp ? dayjs(current.end_timestamp) : dayjs(),
    previous.end_timestamp ? dayjs(previous.end_timestamp) : dayjs(),
  ];

  const earliestStart = starts.reduce((a, b) => a.isBefore(b) ? a : b);
  const latestEnd = ends.reduce((a, b) => a.isAfter(b) ? a : b);

  return {
    ...current,
    start_timestamp: earliestStart.toISOString(),
    end_timestamp: latestEnd.toISOString(),
  };
}
