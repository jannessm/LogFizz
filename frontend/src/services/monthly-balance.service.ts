import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
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
} from '../../../lib/utils/monthlyBalance.js';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);

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

    // Do not calculate balance if no starting_from is set
    const startingFrom = target.starting_from
      ? dayjs(target.starting_from).utc()
      : null;
    if (!startingFrom) {
      // Delete any existing balance for this target
      const balanceId = `${targetId}-${year}-${month}`;
      await deleteMonthlyBalance(balanceId);
      return null;
    }

    // Get ending_at date if set
    const endingAt = target.ending_at
      ? dayjs(target.ending_at).utc()
      : null;

    // Calculate date range for the month
    const startDate = dayjs
      .utc(`${year}-${month.toString().padStart(2, '0')}-01`)
      .startOf('day');
    const endDate = startDate.add(1, 'month');

    // Check if this month is before the starting_from date
    if (endDate.isBefore(startingFrom) || endDate.isSame(startingFrom)) {
      // This month is entirely before starting_from, no balance should be calculated
      const balanceId = `${targetId}-${year}-${month}`;
      await deleteMonthlyBalance(balanceId);
      return null;
    }

    // Check if this month is entirely after the ending_at date
    if (endingAt && startDate.isAfter(endingAt)) {
      // This month is entirely after ending_at, no balance should be calculated
      const balanceId = `${targetId}-${year}-${month}`;
      await deleteMonthlyBalance(balanceId);
      return null;
    }

    // Calculate the effective start date for time logs
    const effectiveStartDate = startingFrom.isAfter(startDate)
      ? startingFrom
      : startDate;
    
    // Calculate the effective end date for time logs (min of month end or ending_at + 1 day)
    let effectiveEndDate = endDate;
    if (endingAt && endingAt.isBefore(endDate.subtract(1, 'day'))) {
      // ending_at is within this month, limit to day after ending_at
      effectiveEndDate = endingAt.add(1, 'day').startOf('day');
    }

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
    const relevantTimeLogs = allTimeLogs.filter(
      tl =>
        buttonIds.has(tl.button_id) &&
        !tl.deleted_at &&
        tl.start_timestamp &&
        dayjs(tl.start_timestamp).isAfter(effectiveStartDate.subtract(1, 'day')) &&
        dayjs(tl.start_timestamp).isBefore(effectiveEndDate)
    );

    // Sort by start_timestamp
    relevantTimeLogs.sort((a, b) =>
      new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime()
    );

    // Create raw data array with auto_subtract_breaks flag
    const rawData = relevantTimeLogs.map(tl => ({
      auto_subtract_breaks: buttonBreakMap.get(tl.button_id) ?? false,
    }));

    // Convert timeLogs to the format expected by the shared function
    const timeLogsForCalc = relevantTimeLogs.map(tl => ({
      start_timestamp: new Date(tl.start_timestamp),
      end_timestamp: tl.end_timestamp ? new Date(tl.end_timestamp) : undefined,
      duration_minutes: tl.duration_minutes,
    }));

    // Calculate worked minutes from time logs
    const workedMinutes = calculateWorkedMinutesShared(timeLogsForCalc, rawData);

    // Calculate due minutes based on target
    const dueMinutes = await this.calculateDueMinutes(
      target,
      year,
      month,
      target.exclude_holidays
    );

    // Calculate this month's balance
    const thisMonthBalance = workedMinutes - dueMinutes;

    // Get cumulative balance from previous month
    const previousMonthBalance = await this.getPreviousMonthCumulativeBalance(
      targetId,
      year,
      month,
      startingFrom
    );

    // Total balance = previous cumulative + this month's balance
    const balanceMinutes = previousMonthBalance + thisMonthBalance;

    // Create or update balance
    const balanceId = `${targetId}-${year}-${month}`;
    const existingBalance = await getMonthlyBalance(balanceId);

    const balance: MonthlyBalance = {
      id: balanceId,
      user_id: target.user_id || '',
      target_id: targetId,
      year,
      month,
      worked_minutes: workedMinutes,
      due_minutes: dueMinutes,
      balance_minutes: balanceMinutes,
      exclude_holidays: target.exclude_holidays,
      created_at: existingBalance?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      target: target,
    };

    await saveMonthlyBalance(balance);
    return balance;
  }

  /**
   * Get the cumulative balance from the previous month
   * Returns 0 if there's no previous balance or if before starting_from
   */
  private async getPreviousMonthCumulativeBalance(
    targetId: string,
    year: number,
    month: number,
    startingFrom: dayjs.Dayjs | null
  ): Promise<number> {
    const currentMonth = dayjs.utc(
      `${year}-${month.toString().padStart(2, '0')}-01`
    );
    const previousMonth = currentMonth.subtract(1, 'month');
    const prevYear = previousMonth.year();
    const prevMonth = previousMonth.month() + 1;

    // Check if previous month is entirely before starting_from
    if (startingFrom) {
      const currentMonthStart = currentMonth.startOf('day');
      if (
        startingFrom.isAfter(currentMonthStart) ||
        startingFrom.isSame(currentMonthStart)
      ) {
        return 0;
      }
    }

    // Get previous month's balance
    const balanceId = `${targetId}-${prevYear}-${prevMonth}`;
    const previousBalance = await getMonthlyBalance(balanceId);

    return previousBalance ? previousBalance.balance_minutes : 0;
  }

  /**
   * Calculate due minutes based on target and month
   * Respects starting_from date - only counts days on or after starting_from
   * Respects ending_at date - only counts days on or before ending_at
   */
  private async calculateDueMinutes(
    target: DailyTarget,
    year: number,
    month: number,
    excludeHolidays: boolean
  ): Promise<number> {
    // For frontend, we don't have holiday data available locally
    // In a production app, you might want to sync holidays from the backend
    // For now, we'll pass an empty set
    const holidays: Set<string> = new Set();

    // If you want to support holidays in the frontend, you would need to:
    // 1. Add a holidays table to the IndexedDB schema
    // 2. Sync holidays from the backend
    // 3. Query holidays here and pass them to calculateDueMinutesShared

    // Convert target to the format expected by the shared function
    const targetForCalc = {
      weekdays: target.weekdays,
      duration_minutes: target.duration_minutes,
      starting_from: target.starting_from ? new Date(target.starting_from) : null,
      ending_at: target.ending_at ? new Date(target.ending_at) : null,
    };

    return calculateDueMinutesShared(targetForCalc, year, month, holidays);
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
