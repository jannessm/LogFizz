import { derived, get } from 'svelte/store';
import type { Balance, TimeLog } from '../types';
import {
  saveBalance,
  deleteBalance,
  getBalancesByDate,
  getBalancesByTargetId,
  getTimeLogsByYearMonth,
  getBalance,
  getBalanceCalcMeta,
  setBalanceCalcMetaForTarget,
  clearBalanceCalcMeta,
  getAllBalances,
} from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig, mapToArray } from './base-store';
import { dayjs, userTimezone } from '../../../lib/utils/dayjs.js';
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
import { generateBalanceId } from '../../../lib/types/index.js';
import { calculateTimelogDuration } from '../../../lib/dist/utils/balance';

/**
 * Configuration for the balances store
 * Balances track work hours vs. target hours at daily/monthly/yearly granularity
 */
const balancesConfig: BaseStoreConfig<Balance> = {
  db: {
    getAll: getAllBalances,
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
 * Build a Map of holiday date sets keyed by state_code for a given target and month.
 * Each entry maps a state_code to the set of holiday dates that apply to it so that
 * calculateDueMinutes can look up only the holidays relevant to each spec's own
 * state, preventing e.g. a Bavaria holiday from being applied to a Berlin spec.
 *
 * @param target - Target whose specs are inspected
 * @param year  - Year to look up holidays for
 * @param month - Month (1-12) to look up holidays for
 * @returns Map of state_code → Set of holiday dates in YYYY-MM-DD format
 */
export function buildHolidaysSet(
  target: TargetWithSpecs,
  year: number,
  month: number
): Map<string, Set<string>> {
  const holidaysMap = new Map<string, Set<string>>();
  for (const spec of target.target_specs || []) {
    if (spec.exclude_holidays && spec.state_code) {
      if (!holidaysMap.has(spec.state_code)) {
        const dates = new Set<string>();
        holidaysStore.getHolidaysForMonth(spec.state_code, year, month)
          .forEach(h => dates.add(h.date));
        holidaysMap.set(spec.state_code, dates);
      }
    }
  }
  return holidaysMap;
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
  holidaysSet: Map<string, Set<string>>;
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
  // Filter to only include timelogs from timers linked to this specific target
  // and exclude deleted timelogs
  const timelogs = allTimelogs.filter(tl => {
    if (tl.deleted_at) return false;
    const timer = _timers.find(t => t.id === tl.timer_id);
    return timer !== undefined && timer.target_id === targetId;
  });
  allTimelogs.forEach(tl => {
    tl.duration_minutes = calculateTimelogDuration(tl);
  });

  // Build holidays set for the target
  const holidaysSet = buildHolidaysSet(target, year, month);

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
 * @param holidaysSet - Map of state_code → Set of holiday dates
 * @returns Balance data (without id, user_id, timestamps)
 */
export function calculateBalanceData(
  date: string,
  balanceTarget: BalanceTarget,
  timelogs: TimeLog[],
  holidaysSet: Map<string, Set<string>>
): Omit<Balance, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  const dueMinutes = calculateDueMinutes(date, balanceTarget, holidaysSet);
  const { worked_minutes, counters } = calculateWorkedMinutesForDate(
    date,
    timelogs,
    dueMinutes
  );

  return {
    date,
    target_id: balanceTarget.id,
    due_minutes: dueMinutes,
    worked_minutes,
    cumulative_minutes: 0, // is the cumulation of previous balances without the current one
    worked_days: worked_minutes > 0 ? 1 : 0,
    ...counters,
  };
}

/**
 * Helper to upsert (create or update) a balance
 * Checks if balance exists and updates it, otherwise creates new one
 * Uses composite ID: {target_id}_{date}
 * 
 * @param store - Store instance with create method
 * @param targetId - Target ID for the balance
 * @param date - Date string for the balance
 * @param balanceData - Balance data to save
 * @returns Created or updated balance
 */
async function upsertBalance(
  store: ReturnType<typeof createBalancesStore>,
  targetId: string,
  date: string,
  balanceData: Omit<Balance, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<Balance> {
  const compositeId = generateBalanceId(targetId, date);
  const state = baseStore.getState();
  const existingBalance = state.items.get(compositeId);

  if (existingBalance) {
    return await baseStore.update(existingBalance.id, balanceData);
  } else {
    return await store.create(balanceData);
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
     * Uses composite ID: {target_id}_{date}
     * @param balanceData - Partial balance data
     * @returns Created balance
     */
    async create(balanceData: Partial<Balance>) {
      const targetId = balanceData.target_id || '';
      const date = balanceData.date || dayjs().format('YYYY-MM-DD');
      const compositeId = generateBalanceId(targetId, date);
      
      return baseStore.create({
        id: compositeId,
        user_id: '',
        target_id: targetId,
        date: date,
        due_minutes: balanceData.due_minutes || 0,
        worked_minutes: balanceData.worked_minutes || 0,
        cumulative_minutes: balanceData.cumulative_minutes || 0,
        sick_days: balanceData.sick_days || 0,
        holidays: balanceData.holidays || 0,
        business_trip: balanceData.business_trip || 0,
        child_sick: balanceData.child_sick || 0,
        homeoffice: balanceData.homeoffice || 0,
        normal_days: balanceData.normal_days || 0,
        worked_days: balanceData.worked_days || 0,
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString(),
      });
    },

    async getBalancesByDate(date: string): Promise<Balance[]> {
      const balances = await getBalancesByDate(date);
      return balances.filter(b => !b.deleted_at);
    },

    async getBalancesByTargetId(targetId: string): Promise<Balance[]> {
      const balances = await getBalancesByTargetId(targetId);
      return balances.filter(b => !b.deleted_at);
    },

    /**
     * Get a balance by its composite ID
     * @param id - Composite ID (target_id_date)
     * @returns Balance or undefined
     */
    async getBalanceById(id: string): Promise<Balance | undefined> {
      // First check in-memory store (O(1) lookup)
      const state = baseStore.getState();
      const inMemory = state.items.get(id);
      if (inMemory && !inMemory.deleted_at) return inMemory;
      
      // Fall back to DB
      const balance = await getBalance(id);
      return balance && !balance.deleted_at ? balance : undefined;
    },

    getBalancesByGranularity(granularity: 'daily' | 'monthly' | 'yearly'): Balance[] {
      const state = baseStore.getState();
      return mapToArray(state.items).filter(b => getGranularity(b.date) === granularity);
    },

    /**
     * Calculate and upsert a daily balance for a specific date
     * @param targetId - Target to calculate for
     * @param date - Date in YYYY-MM-DD format
     * @returns Created or updated balance
     */
    async calculateAndUpsertDailyBalance(targetId: string, date: string): Promise<Balance | null> {
      const dateObj = dayjs.utc(date).tz(userTimezone);
      const year = dateObj.year();
      const month = dateObj.month() + 1;

      const context = await prepareCalculationContext(targetId, year, month);
      if (!context) return null;

      const { balanceTarget, timelogs, holidaysSet } = context;
      const balanceData = calculateBalanceData(date, balanceTarget, timelogs, holidaysSet);

      return await upsertBalance(this, targetId, date, balanceData);
    },

    /**
     * Rebuild monthly balances from a start month to end month with cumulative propagation
     * @param targetId - Target to calculate for
     * @param startMonth - Start month (dayjs object or YYYY-MM string)
     * @param endMonth - End month (dayjs object or YYYY-MM string)
     */
    async rebuildMonthlyBalancesFromMonth(
      targetId: string,
      startMonth: dayjs.Dayjs | string,
      endMonth: dayjs.Dayjs | string
    ): Promise<void> {
      const start = typeof startMonth === 'string' ? dayjs(startMonth) : startMonth;
      const end = typeof endMonth === 'string' ? dayjs(endMonth) : endMonth;
      
      // Load all balances for this target from DB (not just in-memory)
      const allBalances = await getBalancesByTargetId(targetId);
      const dailyBalances = allBalances.filter(b => 
        getGranularity(b.date) === 'daily' && !b.deleted_at
      );
      
      // Get previous month's cumulation
      const prevMonth = start.subtract(1, 'month');
      const prevMonthStr = prevMonth.format('YYYY-MM');
      const prevBal = await this.getBalanceById(generateBalanceId(targetId, prevMonthStr));
      let cumulation = prevBal 
        ? prevBal.cumulative_minutes + (prevBal.worked_minutes - prevBal.due_minutes)
        : 0;

      // Rebuild each month
      for (let m = start.startOf('month'); m.isSameOrBefore(end, 'month'); m = m.add(1, 'month')) {
        const monthStr = m.format('YYYY-MM');
        const dailies = dailyBalances
          .filter(b => b.date.startsWith(monthStr))
          .sort((a, b) => a.date.localeCompare(b.date));

        if (dailies.length === 0) continue;

        const aggregated = aggregateToMonthly(dailies, cumulation);
        await upsertBalance(this, targetId, monthStr, aggregated);
        
        // Update cumulation for next month
        cumulation += (aggregated.worked_minutes - aggregated.due_minutes);
      }
    },

    /**
     * Rebuild yearly balances from a start year to end year with cumulative propagation
     * @param targetId - Target to calculate for
     * @param startYear - Start year
     * @param endYear - End year
     */
    async rebuildYearlyBalancesFromYear(
      targetId: string,
      startYear: number,
      endYear: number
    ): Promise<void> {
      // Load all balances for this target from DB (not just in-memory)
      const allBalances = await getBalancesByTargetId(targetId);
      const monthlyBals = allBalances.filter(b => 
        getGranularity(b.date) === 'monthly' && !b.deleted_at
      );
      
      // Get previous year's cumulation
      const prevYearStr = `${startYear - 1}`;
      const prevBal = await this.getBalanceById(generateBalanceId(targetId, prevYearStr));
      let cumulation = prevBal 
        ? prevBal.cumulative_minutes + (prevBal.worked_minutes - prevBal.due_minutes)
        : 0;

      // Rebuild each year
      for (let year = startYear; year <= endYear; year++) {
        const yearStr = `${year}`;
        const monthlies = monthlyBals
          .filter(b => b.date.startsWith(yearStr))
          .sort((a, b) => a.date.localeCompare(b.date));

        if (monthlies.length === 0) continue;

        const aggregated = aggregateToYearly(monthlies, cumulation);
        await upsertBalance(this, targetId, yearStr, aggregated);
        
        // Update cumulation for next year
        cumulation += (aggregated.worked_minutes - aggregated.due_minutes);
      }
    },

    /**
     * Unified function to ensure balances are up-to-date for a target
     * Handles:
     * - First-time initialization (no balances exist)
     * - Extension (balances exist but < today)
     * - Recalculation of affected days (when timelog is provided)
     * 
     * @param targetId - Target to update balances for
     * @param affectedTimelog - Optional timelog that triggered the update
     */
    async ensureBalancesUpToDate(
      targetId: string,
      affectedTimelog?: TimeLog
    ): Promise<void> {
      const _targets = get(targets) as TargetWithSpecs[];
      const target = _targets.find(t => t.id === targetId);
      
      if (!target?.target_specs?.length) {
        return;
      }

      // Determine the calculation range from target specs
      const sortedSpecs = [...target.target_specs].sort((a, b) =>
        dayjs(a.starting_from).unix() - dayjs(b.starting_from).unix()
      );
      
      const rangeStart = dayjs(sortedSpecs[0].starting_from).startOf('day');
      const lastSpec = sortedSpecs[sortedSpecs.length - 1];
      const specEnd = lastSpec.ending_at ? dayjs(lastSpec.ending_at) : null;
      const today = dayjs().startOf('day');
      const rangeEnd = specEnd && specEnd.isBefore(today) ? specEnd : today;

      // ── 1. Read metadata ──
      const meta = await getBalanceCalcMeta();
      const targetMeta = meta?.targets[targetId];
      const lastUpdatedDay = targetMeta?.last_updated_day
        ? dayjs(targetMeta.last_updated_day)
        : null;

      // ── 2. Extend daily balances (create only if missing) ──
      const nextDayAfterLastUpdated = lastUpdatedDay 
        ? lastUpdatedDay.add(1, 'day') 
        : rangeStart;
      const extendFrom = nextDayAfterLastUpdated.isAfter(rangeStart) 
        ? nextDayAfterLastUpdated 
        : rangeStart;

      if (extendFrom.isSameOrBefore(rangeEnd, 'day')) {
        for (let d = extendFrom; d.isSameOrBefore(rangeEnd, 'day'); d = d.add(1, 'day')) {
          const dateStr = d.format('YYYY-MM-DD');
          const existingBalance = await this.getBalanceById(
            generateBalanceId(targetId, dateStr)
          );

          if (!existingBalance) {
            await this.calculateAndUpsertDailyBalance(targetId, dateStr);
          }
        }
      }

      // ── 3. Recalculate affected days (if timelog provided) ──
      let earliestImpacted = extendFrom;
      
      if (affectedTimelog) {
        // Use the timelog's own timezone so that e.g. a Berlin 00:30-01:30 log
        // (UTC 23:30 prev day - 00:30) is attributed to the correct Berlin date
        const logTz = affectedTimelog.timezone || userTimezone;
        const affectedStart = dayjs.utc(affectedTimelog.start_timestamp).tz(logTz).startOf('day');
        const affectedEnd = (affectedTimelog.end_timestamp
          ? dayjs.utc(affectedTimelog.end_timestamp).tz(logTz)
          : dayjs.utc().tz(logTz)
        ).endOf('day');

        // Update earliest impacted for monthly/yearly rebuild
        if (affectedStart.isBefore(earliestImpacted)) {
          earliestImpacted = affectedStart;
        }

        // Recalculate each affected day
        for (let d = affectedStart; d.isSameOrBefore(affectedEnd, 'day'); d = d.add(1, 'day')) {
          await this.calculateAndUpsertDailyBalance(targetId, d.format('YYYY-MM-DD'));
        }
      }

      // ── 4. Rebuild monthly balances with cumulative propagation ──
      await this.rebuildMonthlyBalancesFromMonth(
        targetId,
        earliestImpacted.startOf('month'),
        rangeEnd
      );

      // ── 5. Rebuild yearly balances with cumulative propagation ──
      await this.rebuildYearlyBalancesFromYear(
        targetId,
        earliestImpacted.year(),
        rangeEnd.year()
      );

      // ── 6. Update metadata ──
      await setBalanceCalcMetaForTarget(targetId, rangeEnd.format('YYYY-MM-DD'), target.user_id);
    },

    /**
     * Initialize/update all balances for all targets
     * Called once on data load
     * Handles:
     * - First-time initialization (no balances exist)
     * - Extension (balances exist but < today)
     * - No-op (balances already up to date)
     */
    async init(): Promise<void> {
      const _targets = get(targets) as TargetWithSpecs[];

      if (_targets.length === 0) {
        console.log('No targets found, skipping balance initialization');
        return;
      }

      console.log(`Initializing/updating balances for ${_targets.length} target(s)...`);

      for (const target of _targets) {
        try {
          await this.ensureBalancesUpToDate(target.id);
        } catch (error) {
          console.error(`Error updating balances for target ${target.id}:`, error);
        }
      }

      console.log('Balance initialization/update complete');
    },

    /**
     * Force recalculate all balances for a target (or all targets)
     * Clears metadata first, then calls init() to rebuild everything
     * Use this when user explicitly wants to recalculate or after data corruption
     * 
     * @param targetId - Optional target ID. If omitted, recalculates all targets.
     */
    async recalculateBalances(targetId?: string): Promise<void> {
      const _targets = get(targets) as TargetWithSpecs[];
      const targetsToProcess = targetId
        ? _targets.filter(t => t.id === targetId)
        : _targets;

      // Clear metadata and existing balances for affected targets
      for (const target of targetsToProcess) {
        // Clear metadata for this target
        await clearBalanceCalcMeta(target.id);
        
        // Delete existing balances
        const state = baseStore.getState();
        const balancesToDelete = mapToArray(state.items).filter(b => b.target_id === target.id);
        for (const balance of balancesToDelete) {
          await baseStore.delete(balance);
        }
      }

      // Rebuild using unified function
      for (const target of targetsToProcess) {
        await this.ensureBalancesUpToDate(target.id);
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
      return await this.calculateAndUpsertDailyBalance(targetId, date);
    },
  };
}

export const balancesStore = createBalancesStore();

/** Derived store providing direct access to all balances */
export const balances = derived(
  balancesStore,
  ($store) => mapToArray($store.items)
);

/** Derived store for daily balances (date format: YYYY-MM-DD) */
export const dailyBalances = derived(
  balancesStore,
  ($store) => mapToArray($store.items).filter(b => b.date.length === 10)
);

/** Derived store for monthly balances (date format: YYYY-MM) */
export const monthlyBalances = derived(
  balancesStore,
  ($store) => mapToArray($store.items).filter(b => b.date.length === 7)
);

/** Derived store for yearly balances (date format: YYYY) */
export const yearlyBalances = derived(
  balancesStore,
  ($store) => mapToArray($store.items).filter(b => b.date.length === 4)
);
