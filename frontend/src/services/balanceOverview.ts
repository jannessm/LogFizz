import type { Balance } from '../types';
import { balancesStore } from '../stores/balances';

export type BalanceGranularity = 'year' | 'month' | 'day';

export type BalancePeriod =
  | { year: number }
  | { year: number; month: number }
  | { date: string }; // YYYY-MM-DD

function getDateKey(granularity: BalanceGranularity, period: BalancePeriod): string {
  if (granularity === 'year') {
    if (!('year' in period)) throw new Error('Year period must include year');
    return String(period.year);
  }

  if (granularity === 'month') {
    if (!('year' in period) || !('month' in period)) {
      throw new Error('Month period must include year and month');
    }
    return `${period.year}-${String(period.month).padStart(2, '0')}`;
  }

  // day
  if (!('date' in period)) throw new Error('Day period must include date');
  return period.date;
}

export async function loadBalancesByTargetId(params: {
  granularity: BalanceGranularity;
  period: BalancePeriod;
}): Promise<{ dateKey: string; balancesByTargetId: Map<string, Balance> }>
{
  const { granularity, period } = params;
  const dateKey = getDateKey(granularity, period);

  // Local-first read
  const local = await balancesStore.getBalancesByDate(dateKey);

  const balancesByTargetId = new Map<string, Balance>();
  for (const b of local) {
    if (!b.deleted_at) {
      balancesByTargetId.set(b.target_id, b);
    }
  }

  return { dateKey, balancesByTargetId };
}
