import { dayjs } from '../../../lib/utils/dayjs.js';
import type { TargetWithSpecs, TimeLog } from '../types';
import { targetsStore } from '../stores/targets.js';
import { balancesStore } from '../stores/balances.js';

/**
 * Triggers balance recalculation for timelogs.
 * Identifies all affected dates (handling multi-day timelogs) and triggers
 * daily balance recalculation which propagates up through monthly and yearly balances.
 * 
 * Algorithm from docs/balances.md:
 * 1. For each granularity level (daily, monthly, yearly):
 *    - Get balances directly affected by the timelog
 *    - Recalculate each daily balance completely
 *    - For monthly/yearly: propagate cumulations through next_balance_id chain
 * 
 * @param timelog - Timelog that was created/updated/deleted
 * @param stores - Object containing balancesStore and targetsStore references
 */
export async function recalculateBalancesForTimeLog(
  timelog: TimeLog,
  targets?: TargetWithSpecs[],
) {

  if (!targets) {
    targets = await targetsStore.getTargetsByTimerIds([timelog.timer_id]);
  }
  if (targets.length === 0) return;
  
  const start = dayjs(timelog.start_timestamp);
  const end = timelog.end_timestamp ? dayjs(timelog.end_timestamp) : dayjs();
  
  // Get all affected dates (timelog may span multiple days)
  const affectedDates: string[] = [];
  let current = start.startOf('day');
  const endDay = end.startOf('day');
  
  while (current.isSameOrBefore(endDay, 'day')) {
    affectedDates.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }
  
  // Get unique months and years from affected dates
  const affectedMonths = new Set(affectedDates.map(d => d.substring(0, 7))); // YYYY-MM
  const affectedYears = new Set(affectedDates.map(d => d.substring(0, 4))); // YYYY
  
  for (const target of targets) {
    // 1. Recalculate daily balances
    for (const date of affectedDates) {
      await balancesStore.recalculateDailyBalance(target.id, date);
    }
    
    // 2. Recalculate monthly balances and propagate cumulations
    for (const month of affectedMonths) {
      const [year, monthNum] = month.split('-').map(Number);
      await balancesStore.recalculateMonthlyBalance(target.id, year, monthNum);
    }
    
    // 3. Recalculate yearly balances and propagate cumulations
    for (const year of affectedYears) {
      await balancesStore.recalculateYearlyBalance(target.id, Number(year));
    }
  }
}
