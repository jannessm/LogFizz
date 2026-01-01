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
  type WholeDayCounters,
} from '../../../lib/utils/balance.js';

/**
 * Configuration for the balances store
 * Balances track work hours vs. target hours at daily/monthly/yearly granularity
 */
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

const baseStore = createBaseStore<Balance>(balancesConfig);

/**
 * Determine balance granularity from date string format
 * @param date - Date string (YYYY, YYYY-MM, or YYYY-MM-DD)
 * @returns Granularity level
 */
function getGranularity(date: string): 'daily' | 'monthly' | 'yearly' {
  if (date.length === 4) return 'yearly';    // YYYY
  if (date.length === 7) return 'monthly';   // YYYY-MM
  return 'daily';                             // YYYY-MM-DD
}

/**
 * Helper to get target and prepare calculation context
 * Loads target, timelogs, and builds holidays set for balance calculations
 * 
 * @param targetId - Target ID to prepare context for
 * @param year - Year for timelogs
 * @param month - Month for timelogs (1-12)
 * @returns Context with target, timelogs, and holidays or null if target not found
 */
async function prepareCalculationContext(
  targetId: string,
  year: number,
  month: number
): Promise<{
  target: TargetWithSpecs;
  balanceTarget: BalanceTarget;
  timelogs: TimeLog[];
  holidaysSet: Set<string>;
} | null> {
  const _targets = get(targets) as TargetWithSpecs[];
  const target = _targets.find(t => t.id === targetId);
  if (!target) {
    console.error(`Target with ID ${targetId} not found`);
    return null;
  }

  // Load timelogs for this month
  const allTimelogs = await getTimeLogsByYearMonth(year, month);
  const _timers = get(timers);
  const timelogs = allTimelogs.filter(tl => {
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

  return {
    target,
    balanceTarget: target as unknown as BalanceTarget,
    timelogs: timelogs as TimeLog[],
    holidaysSet,
  };
}

/**
 * Helper to calculate balance data for a specific date
 * Returns the balance values without creating/updating the entity
 * Uses shared calculation functions from lib/utils/balance.ts
 * 
 * @param date - Date string (YYYY-MM-DD)
 * @param balanceTarget - Target configuration
 * @param timelogs - Array of timelogs to include in calculation
 * @param holidaysSet - Set of holiday dates
 * @returns Balance data (without id, user_id, target_id, timestamps)
 */
function calculateBalanceData(
  date: string,
  balanceTarget: BalanceTarget,
  timelogs: TimeLog[],
  holidaysSet: Set<string>
): Omit<Balance, 'id' | 'user_id' | 'target_id' | 'next_balance_id' | 'created_at' | 'updated_at'> {
  const dueMinutes = calculateDueMinutes(date, balanceTarget, holidaysSet);
  const { worked_minutes: workedMinutes, counters } = calculateWorkedMinutesForDate(
    date,
    timelogs
  );

  // For special days, add due_minutes to worked_minutes (as per docs)
  let adjustedWorked = workedMinutes;
  if (counters.sick_days > 0 || counters.holidays > 0 || 
      counters.business_trip > 0 || counters.child_sick > 0 || counters.normal > 0) {
    adjustedWorked += dueMinutes;
  }

  delete((counters as Partial<WholeDayCounters>).normal);

  return {
    date,
    due_minutes: dueMinutes,
    worked_minutes: adjustedWorked,
    cumulative_minutes: adjustedWorked - dueMinutes,
    worked_days: adjustedWorked > 0 && counters.business_trip === 0 ? 1 : 0,
    ...counters,
  };
}

/**
 * Helper to upsert (create or update) a balance
 * Checks if balance exists and updates it, otherwise creates new one
 * 
 * @param store - Store instance with create method
 * @param targetId - Target ID for the balance
 * @param date - Date string for the balance
 * @param balanceData - Balance data to save
 * @param state - Current store state
 * @returns Created or updated balance
 */
async function upsertBalance(
  store: any,
  targetId: string,
  date: string,
  balanceData: Omit<Balance, 'id' | 'user_id' | 'target_id' | 'next_balance_id' | 'created_at' | 'updated_at'>,
  state: any
): Promise<Balance> {
  const existingBalance = state.items.find(
    (b: Balance) => b.target_id === targetId && b.date === date
  );

  if (existingBalance) {
    return await baseStore.update(existingBalance.id, balanceData);
  } else {
    return await store.create({
      target_id: targetId,
      ...balanceData,
    });
  }
}

/**
 * Creates the balances store with balance calculation methods
 * @returns Enhanced balance store with CRUD and calculation operations
 */
function createBalancesStore() {
  return {
    ...baseStore,

    /**
     * Create a new balance entry
     * @param balanceData - Partial balance data
     * @returns Created balance
     */
    async create(balanceData: Partial<Balance>) {
      return baseStore.create({
        id: crypto.randomUUID(),
        user_id: '',
        target_id: balanceData.target_id || '',
        next_balance_id: balanceData.next_balance_id || null,
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
      const context = await prepareCalculationContext(targetId, year, month);
      if (!context) return [];

      const { balanceTarget, timelogs, holidaysSet } = context;
      const dailyBalances: Balance[] = [];
      const monthStart = dayjs.utc(`${year}-${month.toString().padStart(2, '0')}-01`);
      const daysInMonth = monthStart.daysInMonth();
      const today = dayjs();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = monthStart.date(day);
        if (date.isAfter(today, 'day')) break;

        const dateStr = date.format('YYYY-MM-DD');
        const balanceData = calculateBalanceData(dateStr, balanceTarget, timelogs, holidaysSet);
        
        const balance = await this.create({
          target_id: targetId,
          ...balanceData,
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

    /**
     * Recalculate a single daily balance for a specific date
     * Completely recalculates from timelogs (doesn't use differences)
     * 
     * @param targetId - Target to calculate for
     * @param date - Date in YYYY-MM-DD format
     */
    async recalculateDailyBalance(targetId: string, date: string): Promise<Balance | null> {
      const dateObj = dayjs(date);
      const year = dateObj.year();
      const month = dateObj.month() + 1;

      const context = await prepareCalculationContext(targetId, year, month);
      if (!context) return null;

      const { balanceTarget, timelogs, holidaysSet } = context;
      const balanceData = calculateBalanceData(date, balanceTarget, timelogs, holidaysSet);
      const state = baseStore.getState();

      return await upsertBalance(this, targetId, date, balanceData, state);
    },

    /**
     * Recalculate monthly balance and propagate cumulations
     * 
     * @param targetId - Target to calculate for
     * @param year - Year
     * @param month - Month (1-12)
     */
    async recalculateMonthlyBalance(targetId: string, year: number, month: number): Promise<Balance | null> {
      const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
      const dailyBalances = this.getBalancesByGranularity('daily')
        .filter(b => b.target_id === targetId && b.date.startsWith(monthStr))
        .sort((a, b) => a.date.localeCompare(b.date));

      if (dailyBalances.length === 0) {
        return null;
      }

      // Get previous month's cumulation
      const prevMonthStr = dayjs(`${monthStr}-01`).subtract(1, 'month').format('YYYY-MM');
      const state = baseStore.getState();
      const prevMonthBalance = state.items.find(
        b => b.target_id === targetId && b.date === prevMonthStr
      );
      const previousCumulation = prevMonthBalance?.cumulative_minutes || 0;

      const aggregated = aggregateToMonthly(dailyBalances, previousCumulation);
      const monthlyBalance = await upsertBalance(this, targetId, monthStr, aggregated, state);

      // Propagate cumulations through next_balance_id chain
      await this.propagateCumulation(monthlyBalance);

      return monthlyBalance;
    },

    /**
     * Recalculate yearly balance and propagate cumulations
     * 
     * @param targetId - Target to calculate for
     * @param year - Year
     */
    async recalculateYearlyBalance(targetId: string, year: number): Promise<Balance | null> {
      const yearStr = `${year}`;
      const monthlyBalances = this.getBalancesByGranularity('monthly')
        .filter(b => b.target_id === targetId && b.date.startsWith(yearStr))
        .sort((a, b) => a.date.localeCompare(b.date));

      if (monthlyBalances.length === 0) {
        return null;
      }

      // Get previous year's cumulation
      const prevYearStr = `${year - 1}`;
      const state = baseStore.getState();
      const prevYearBalance = state.items.find(
        b => b.target_id === targetId && b.date === prevYearStr
      );
      const previousCumulation = prevYearBalance?.cumulative_minutes || 0;

      const aggregated = aggregateToYearly(monthlyBalances, previousCumulation);
      const yearlyBalance = await upsertBalance(this, targetId, yearStr, aggregated, state);

      // Propagate cumulations through next_balance_id chain
      await this.propagateCumulation(yearlyBalance);

      return yearlyBalance;
    },

    /**
     * Propagate cumulation changes through the next_balance_id chain
     * As per docs/balances.md: Updates cumulative_minutes for all linked balances
     * 
     * @param balance - Starting balance to propagate from
     */
    async propagateCumulation(balance: Balance): Promise<void> {
      let cumulative = balance.cumulative_minutes;
      let currentBalanceId = balance.next_balance_id;

      while (currentBalanceId) {
        const state = baseStore.getState();
        const nextBalance = state.items.find(b => b.id === currentBalanceId);
        
        if (!nextBalance) break;

        // Update cumulative for next balance
        const updatedBalance = await baseStore.update(nextBalance.id, {
          cumulative_minutes: cumulative,
        });

        // Calculate new cumulative for the chain
        cumulative = updatedBalance.cumulative_minutes + updatedBalance.worked_minutes - updatedBalance.due_minutes;
        currentBalanceId = updatedBalance.next_balance_id;
      }
    },
  };
}

export const balancesStore = createBalancesStore();

/** Derived store providing direct access to all balances */
export const balances = derived(
  balancesStore,
  ($store) => $store.items
);

/** Derived store for daily balances (date format: YYYY-MM-DD) */
export const dailyBalances = derived(
  balancesStore,
  ($store) => $store.items.filter(b => b.date.length === 10)
);

/** Derived store for monthly balances (date format: YYYY-MM) */
export const monthlyBalances = derived(
  balancesStore,
  ($store) => $store.items.filter(b => b.date.length === 7)
);

/** Derived store for yearly balances (date format: YYYY) */
export const yearlyBalances = derived(
  balancesStore,
  ($store) => $store.items.filter(b => b.date.length === 4)
);
