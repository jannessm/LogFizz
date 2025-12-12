import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import type { MonthlyBalance, DailyTarget, TimeLog, Button } from '../types';
import {
  getAllTargets,
  getAllTimeLogs,
  getAllButtons,
  saveMonthlyBalance,
  getMonthlyBalance,
  deleteMonthlyBalance,
} from '../lib/db';
import {
  calculateWorkedMinutes as calculateWorkedMinutesShared,
  calculateDueMinutes as calculateDueMinutesShared,
  getEarliestAffectedMonth,
  shouldCalculateBalance,
  calculateEffectiveDateRange,
  getPreviousMonthCumulativeBalance,
  calculateMonthlyBalanceCore,
  type TimeLogWithType,
} from '../../../lib/utils/monthlyBalance.js';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

/**
 * Monthly Balance Service for frontend
 * Handles calculation and management of monthly balances in the client
 */
export class MonthlyBalanceService {
  /**
   * Check and recalculate missing monthly balances
   * For each target with starting_from, ensure all months from starting_from until today have balances
   */
  async checkAndRecalculateMissingBalances(): Promise<void> {
    const targets = await getAllTargets();
    const today = dayjs().utc();
    
    for (const target of targets) {
      // Skip deleted targets or targets without starting_from
      if (target.deleted_at || !target.starting_from) {
        continue;
      }

      const startingFrom = dayjs(target.starting_from).utc().startOf('month');
      let currentMonth = startingFrom;

      // Iterate through each month from starting_from to today
      while (currentMonth.isBefore(today) || currentMonth.isSame(today, 'month')) {
        const year = currentMonth.year();
        const month = currentMonth.month() + 1; // 1-12

        // Check if balance exists
        const balanceId = `${target.id}-${year}-${month}`;
        const existingBalance = await getMonthlyBalance(balanceId);

        if (!existingBalance) {
          // Balance doesn't exist, calculate it
          await this.calculateMonthlyBalance(target.id, year, month);
        }

        currentMonth = currentMonth.add(1, 'month');
      }
    }
  }

  /**
   * Recalculate monthly balances for affected months based on time logs
   * Finds the earliest affected month and recalculates all months from there until today
   */
  async recalculateAffectedMonthlyBalances(
    timeLogs: Array<{ start_timestamp: Date | string; button_id: string }>
  ): Promise<void> {
    if (timeLogs.length === 0) {
      return;
    }

    // Convert string timestamps to Date objects
    const normalizedTimeLogs = timeLogs.map(log => ({
      ...log,
      start_timestamp: typeof log.start_timestamp === 'string' ? new Date(log.start_timestamp) : log.start_timestamp,
    }));

    // Find the earliest affected month
    const earliestDate = getEarliestAffectedMonth(normalizedTimeLogs);

    if (!earliestDate) {
      return;
    }

    // Calculate end date (current month)
    const today = dayjs().utc();
    const endDate = today.startOf('month');

    // Get all targets to recalculate their balances
    const targets = await getAllTargets();
    const targetsWithStarting = targets.filter(
      t => !t.deleted_at && t.starting_from
    );

    // Recalculate all months from earliest affected month to current month
    let currentMonth = earliestDate;

    while (currentMonth.isBefore(endDate) || currentMonth.isSame(endDate)) {
      const year = currentMonth.year();
      const month = currentMonth.month() + 1; // 1-12

      // Recalculate for each target
      for (const target of targetsWithStarting) {
        await this.calculateMonthlyBalance(target.id, year, month);
      }

      // Move to next month
      currentMonth = currentMonth.add(1, 'month');
    }
  }

  /**
   * Calculate and save monthly balance for a target
   * Includes cumulative balance from previous months (since starting_from)
   * Returns null if target has no starting_from date
   * Returns null if the entire month is after ending_at date
   */
  async calculateMonthlyBalance(
    targetId: string,
    year: number,
    month: number
  ): Promise<MonthlyBalance | null> {
    // Get all targets and buttons
    const targets = await getAllTargets();
    const target = targets.find(t => t.id === targetId);

    if (!target || target.deleted_at) {
      throw new Error('Target not found');
    }

    // Convert weekdays and duration_minutes from strings to numbers if needed
    target.weekdays = target.weekdays.map((day: any) =>
      typeof day === 'string' ? parseInt(day, 10) : day
    );
    target.duration_minutes = target.duration_minutes.map((min: any) =>
      typeof min === 'string' ? parseInt(min, 10) : min
    );

    // Validate if balance should be calculated
    const validation = shouldCalculateBalance(
      {
        weekdays: target.weekdays,
        duration_minutes: target.duration_minutes,
        starting_from: target.starting_from ? new Date(target.starting_from) : null,
        ending_at: target.ending_at ? new Date(target.ending_at) : null,
      },
      year,
      month
    );

    if (!validation.shouldCalculate) {
      // Delete any existing balance for this target
      const balanceId = `${targetId}-${year}-${month}`;
      await deleteMonthlyBalance({ id: balanceId } as any);
      return null;
    }

    // Get starting_from for later use
    const startingFrom = target.starting_from ? dayjs(target.starting_from).utc() : null;

    // Calculate effective date range
    const { effectiveStartDate, effectiveEndDate } = calculateEffectiveDateRange(
      {
        weekdays: target.weekdays,
        duration_minutes: target.duration_minutes,
        starting_from: target.starting_from ? new Date(target.starting_from) : null,
        ending_at: target.ending_at ? new Date(target.ending_at) : null,
      },
      year,
      month
    );

    // Get all buttons linked to this target
    const buttons = await getAllButtons();
    const targetButtons = buttons.filter(b => b.target_id === targetId);
    const buttonIds = new Set(targetButtons.map(b => b.id));

    // Create a map of button_id to auto_subtract_breaks flag
    const buttonBreakMap = new Map<string, boolean>();
    targetButtons.forEach(b => {
      buttonBreakMap.set(b.id, b.auto_subtract_breaks ?? false);
    });

    // Get all time logs for buttons linked to this target in this month (respecting ending_at)
    const allTimeLogs = await getAllTimeLogs();
    const filteredLogs = allTimeLogs.filter(
      tl =>
        buttonIds.has(tl.button_id) &&
        !tl.deleted_at &&
        tl.start_timestamp &&
        dayjs(tl.start_timestamp).isAfter(effectiveStartDate.subtract(1, 'day')) &&
        dayjs(tl.start_timestamp).isBefore(effectiveEndDate)
    );

    // Sort by start_timestamp and convert to TimeLogWithType format
    const relevantTimeLogs: TimeLogWithType[] = filteredLogs
      .sort((a, b) =>
        new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime()
      )
      .map(tl => ({
        start_timestamp: new Date(tl.start_timestamp),
        end_timestamp: tl.end_timestamp ? new Date(tl.end_timestamp) : undefined,
        duration_minutes: tl.duration_minutes,
        type: tl.type,
        button_id: tl.button_id,
      }));

    // Get holidays set (empty for frontend, could be enhanced later)
    const holidays: Set<string> = new Set();

    // Get previous month's cumulative balance
    const previousMonthBalance = await getPreviousMonthCumulativeBalance(
      year,
      month,
      startingFrom,
      async (prevYear: number, prevMonth: number) => {
        const balanceId = `${targetId}-${prevYear}-${prevMonth}`;
        const previousBalance = await getMonthlyBalance(balanceId);
        return previousBalance ? previousBalance.balance_minutes : 0;
      }
    );

    // Calculate balance using shared core function
    const { worked_minutes, due_minutes, balance_minutes } = await calculateMonthlyBalanceCore({
      target: {
        weekdays: target.weekdays,
        duration_minutes: target.duration_minutes,
        starting_from: target.starting_from ? new Date(target.starting_from) : null,
        ending_at: target.ending_at ? new Date(target.ending_at) : null,
      },
      year,
      month,
      timeLogs: relevantTimeLogs,
      buttonBreakMap,
      holidays,
      previousMonthBalance,
    });

    // Create or update balance
    const balanceId = `${targetId}-${year}-${month}`;
    const existingBalance = await getMonthlyBalance(balanceId);

    const balance: MonthlyBalance = {
      id: balanceId,
      user_id: target.user_id || '',
      target_id: targetId,
      year,
      month,
      worked_minutes,
      due_minutes,
      balance_minutes,
      exclude_holidays: target.exclude_holidays,
      created_at: existingBalance?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      target: target,
    };

    await saveMonthlyBalance(balance);
    return balance;
  }

  /**
   * Get monthly balance
   */
  async getMonthlyBalance(
    targetId: string,
    year: number,
    month: number
  ): Promise<MonthlyBalance | null> {
    const balanceId = `${targetId}-${year}-${month}`;
    const balance = await getMonthlyBalance(balanceId);
    return balance ?? null;
  }

  /**
   * Recalculate all balances for a specific month
   */
  async recalculateMonthBalances(
    year: number,
    month: number
  ): Promise<MonthlyBalance[]> {
    const targets = await getAllTargets();
    const balances: MonthlyBalance[] = [];

    for (const target of targets) {
      if (target.deleted_at || !target.starting_from) {
        continue;
      }

      const balance = await this.calculateMonthlyBalance(target.id, year, month);
      if (balance) {
        balances.push(balance);
      }
    }

    return balances;
  }
}

// Export singleton instance
export const monthlyBalanceService = new MonthlyBalanceService();
