import { derived, get } from 'svelte/store';
import type { Balance, TimeLog } from '../types';
import { saveBalance, deleteBalance, getBalancesByDate, getBalancesByTargetId, getTimeLogsByYearMonth } from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig } from './base-store';
import dayjs from '../../../lib/utils/dayjs.js';
import { timers } from './timers';
import { targets } from './targets';
import { holidaysStore } from './holidays';
import type { TargetWithSpecs } from '../types';
import {
  calculateDueMinutes,
  calculateWorkedMinutesForDate,
  aggregateToMonthly,
  aggregateToYearly,
  type Target as BalanceTarget,
} from '../../../lib/utils/balance.js';

// Configure the base store for balances
const balancesConfig: BaseStoreConfig<Balance> = {
  db: {
    getAll: () => getBalancesByDate(dayjs().format('YYYY-MM')),
    save: saveBalance,
    delete: deleteBalance,
  },
  sync: {
    queueUpsert: syncService.queueUpsertBalance.bind(syncService),
    queueDelete: syncService.queueDeleteBalance.bind(syncService),
    syncType: 'balance',
  },
  storeName: 'balances',
};

// Create the base store
const baseStore = createBaseStore<Balance>(balancesConfig);

// Helper: Get balance granularity from date string
function getGranularity(date: string): 'daily' | 'monthly' | 'yearly' {
  if (date.length === 4) return 'yearly';    // YYYY
  if (date.length === 7) return 'monthly';   // YYYY-MM
  return 'daily';                             // YYYY-MM-DD
}

// Create the balances store with custom methods
function createBalancesStore() {
  return {
    ...baseStore,

    async create(balanceData: Partial<Balance>) {
      return baseStore.create({
        id: crypto.randomUUID(),
        user_id: '',
        target_id: balanceData.target_id || '',
        next_balance_id: balanceData.next_balance_id || '',
        parent_balance_id: balanceData.parent_balance_id || '',
        date: balanceData.date || dayjs().format('YYYY-MM-DD'),
        due_minutes: balanceData.due_minutes || 0,
        worked_minutes: balanceData.worked_minutes || 0,
        cumulative_minutes: balanceData.cumulative_minutes || 0,
        sick_days: balanceData.sick_days || 0,
        holidays: balanceData.holidays || 0,
        business_trip: balanceData.business_trip || 0,
        child_sick: balanceData.child_sick || 0,
        worked_days: balanceData.worked_days || 0,
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString(),
      });
    },

    async getBalancesByDate(date: string): Promise<Balance[]> {
      return await getBalancesByDate(date);
    },

    async getBalancesByTargetId(targetId: string): Promise<Balance[]> {
      return await getBalancesByTargetId(targetId);
    },

    getBalancesByGranularity(granularity: 'daily' | 'monthly' | 'yearly'): Balance[] {
      const state = baseStore.getState();
      return state.items.filter(b => getGranularity(b.date) === granularity);
    },

    /**
     * Calculate daily balances for a target in a given year/month
     * Uses shared calculation functions from lib/utils/balance.ts
     */
    async calculateDailyBalances(targetId: string, year: number, month: number): Promise<Balance[]> {
      const _targets = get(targets) as TargetWithSpecs[];
      const target = _targets.find(t => t.id === targetId);
      if (!target) {
        console.error(`Target with ID ${targetId} not found`);
        return [];
      }

      const timelogs = await getTimeLogsByYearMonth(year, month);
      const _timers = get(timers);
      const targetTimelogs = timelogs.filter(tl => {
        const timer = _timers.find(t => t.id === tl.timer_id);
        return timer !== undefined;
      });

      // Build holidays set for the target
      const holidaysSet = new Set<string>();
      for (const spec of target.target_specs || []) {
        if (spec.exclude_holidays && spec.state_code) {
          const holidays = holidaysStore.getHolidaysForMonth(
            spec.state_code.split('-')[0],
            year,
            month
          );
          holidays.forEach(h => holidaysSet.add(h.date));
        }
      }

      const dailyBalances: Balance[] = [];
      const monthStart = dayjs.utc(`${year}-${month.toString().padStart(2, '0')}-01`);
      const daysInMonth = monthStart.daysInMonth();
      const today = dayjs();

      // Cast to BalanceTarget for shared functions
      const balanceTarget = target as unknown as BalanceTarget;

      for (let day = 1; day <= daysInMonth; day++) {
        const date = monthStart.date(day);
        if (date.isAfter(today, 'day')) break;

        const dateStr = date.format('YYYY-MM-DD');

        // Use shared calculation functions
        const dueMinutes = calculateDueMinutes(dateStr, balanceTarget, holidaysSet);
        const { worked_minutes: workedMinutes, counters } = calculateWorkedMinutesForDate(
          dateStr,
          targetTimelogs as TimeLog[]
        );

        // For special days, add due_minutes to worked_minutes (as per docs)
        let adjustedWorked = workedMinutes;
        if (counters.sick_days > 0 || counters.holidays > 0 || 
            counters.business_trip > 0 || counters.child_sick > 0) {
          adjustedWorked += dueMinutes;
        }

        const balance = await this.create({
          target_id: targetId,
          date: dateStr,
          due_minutes: dueMinutes,
          worked_minutes: adjustedWorked,
          cumulative_minutes: adjustedWorked - dueMinutes,
          worked_days: adjustedWorked > 0 && counters.business_trip === 0 ? 1 : 0,
          ...counters,
        });

        dailyBalances.push(balance);
      }

      return dailyBalances;
    },

    /**
     * Aggregate daily balances to monthly
     * Uses shared aggregation function from lib/utils/balance.ts
     */
    async calculateMonthlyBalance(
      targetId: string,
      year: number,
      month: number,
      previousCumulation: number = 0
    ): Promise<Balance | null> {
      const dailyBalances = this.getBalancesByGranularity('daily')
        .filter(b => b.target_id === targetId && b.date.startsWith(`${year}-${month.toString().padStart(2, '0')}`));

      if (dailyBalances.length === 0) {
        return null;
      }

      const aggregated = aggregateToMonthly(dailyBalances, previousCumulation);

      return await this.create({
        target_id: targetId,
        ...aggregated,
      });
    },

    /**
     * Aggregate monthly balances to yearly
     * Uses shared aggregation function from lib/utils/balance.ts
     */
    async calculateYearlyBalance(
      targetId: string,
      year: number,
      previousCumulation: number = 0
    ): Promise<Balance | null> {
      const monthlyBalances = this.getBalancesByGranularity('monthly')
        .filter(b => b.target_id === targetId && b.date.startsWith(`${year}`))
        .sort((a, b) => a.date.localeCompare(b.date));

      if (monthlyBalances.length === 0) {
        return null;
      }

      const aggregated = aggregateToYearly(monthlyBalances, previousCumulation);

      return await this.create({
        target_id: targetId,
        ...aggregated,
      });
    },

    /**
     * Recalculate all balances for a target (or all targets)
     */
    async recalculateBalances(targetId?: string): Promise<void> {
      const _targets = get(targets) as TargetWithSpecs[];
      const targetsToProcess = targetId 
        ? _targets.filter(t => t.id === targetId)
        : _targets;

      for (const target of targetsToProcess) {
        // Calculate daily balances for current year
        const currentYear = dayjs().year();
        const currentMonth = dayjs().month() + 1;

        for (let month = 1; month <= currentMonth; month++) {
          await this.calculateDailyBalances(target.id, currentYear, month);
        }

        // Calculate monthly balances
        let cumulativePrev = 0;
        for (let month = 1; month <= currentMonth; month++) {
          const monthlyBalance = await this.calculateMonthlyBalance(target.id, currentYear, month, cumulativePrev);
          if (monthlyBalance) {
            cumulativePrev = monthlyBalance.cumulative_minutes;
          }
        }

        // Calculate yearly balance
        await this.calculateYearlyBalance(target.id, currentYear);
      }
    },
  };
}

export const balancesStore = createBalancesStore();

// Derived store for balances (maps 'items' to 'balances' for backward compatibility)
export const balances = derived(
  balancesStore,
  ($store) => $store.items
);

// Derived store for daily balances
export const dailyBalances = derived(
  balancesStore,
  ($store) => $store.items.filter(b => b.date.length === 10) // YYYY-MM-DD
);

// Derived store for monthly balances
export const monthlyBalances = derived(
  balancesStore,
  ($store) => $store.items.filter(b => b.date.length === 7) // YYYY-MM
);

// Derived store for yearly balances
export const yearlyBalances = derived(
  balancesStore,
  ($store) => $store.items.filter(b => b.date.length === 4) // YYYY
);
