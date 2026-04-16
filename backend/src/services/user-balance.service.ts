import { AppDataSource } from '../config/database.js';
import { Balance } from '../entities/Balance.js';
import { Target } from '../entities/Target.js';
import { TargetSpec } from '../entities/TargetSpec.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Timer } from '../entities/Timer.js';
import { Holiday } from '../entities/Holiday.js';
import { IsNull } from 'typeorm';
import dayjs from '../../../lib/utils/dayjs.js';
import { generateBalanceId } from '../../../lib/types/index.js';
import {
  calculateDueMinutes,
  calculateWorkedMinutesForDate,
  aggregateToMonthly,
  aggregateToYearly,
  propagateCumulativeMinutes,
  type Target as BalanceTarget,
  type Balance as BalanceType,
} from '../../../lib/utils/balance.js';

/**
 * Per-target balance summary for user emails
 */
export interface TargetBalanceSummary {
  targetName: string;
  currentMonthDate: string;
  currentMonthDueMinutes: number;
  currentMonthWorkedMinutes: number;
  currentMonthBalance: number;
  cumulativeMinutes: number;
  sickDays: number;
  holidays: number;
  childSick: number;
  workedDays: number;
}

/**
 * Service for recalculating balances server-side and producing per-user summaries.
 * Mirrors the frontend logic (ensureBalancesUpToDate) but uses the database directly.
 */
export class UserBalanceService {
  private balanceRepository = AppDataSource.getRepository(Balance);
  private targetRepository = AppDataSource.getRepository(Target);
  private targetSpecRepository = AppDataSource.getRepository(TargetSpec);
  private timeLogRepository = AppDataSource.getRepository(TimeLog);
  private timerRepository = AppDataSource.getRepository(Timer);
  private holidayRepository = AppDataSource.getRepository(Holiday);

  /**
   * Recalculate all balances for a user and return per-target summaries
   */
  async recalculateAndSummarize(userId: string): Promise<TargetBalanceSummary[]> {
    const targets = await this.targetRepository.find({
      where: { user_id: userId, deleted_at: IsNull() },
    });

    const summaries: TargetBalanceSummary[] = [];

    for (const target of targets) {
      const specs = await this.targetSpecRepository.find({
        where: { target_id: target.id },
      });

      if (specs.length === 0) continue;

      // Build BalanceTarget (compatible with lib/utils/balance.ts)
      const balanceTarget: BalanceTarget = {
        id: target.id,
        user_id: target.user_id,
        name: target.name,
        target_specs: specs.map(s => ({
          id: s.id,
          user_id: s.user_id,
          target_id: s.target_id,
          starting_from: s.starting_from.toISOString(),
          ending_at: s.ending_at?.toISOString(),
          duration_minutes: Array.isArray(s.duration_minutes)
            ? s.duration_minutes.map(Number)
            : [],
          exclude_holidays: s.exclude_holidays,
          state_code: s.state_code,
        })),
        created_at: target.created_at.toISOString(),
        updated_at: target.updated_at.toISOString(),
        deleted_at: target.deleted_at?.toISOString(),
      };

      // Determine range
      const sortedSpecs = [...balanceTarget.target_specs].sort((a, b) =>
        dayjs(a.starting_from).unix() - dayjs(b.starting_from).unix()
      );
      const rangeStart = dayjs(sortedSpecs[0].starting_from).startOf('day');
      const lastSpec = sortedSpecs[sortedSpecs.length - 1];
      const specEnd = lastSpec.ending_at ? dayjs(lastSpec.ending_at) : null;
      const today = dayjs().startOf('day');
      const rangeEnd = specEnd && specEnd.isBefore(today) ? specEnd : today;

      // Get timers linked to this target
      const timers = await this.timerRepository.find({
        where: { user_id: userId, target_id: target.id, deleted_at: IsNull() },
      });
      const timerIds = timers.map(t => t.id);

      // Load holidays for applicable specs
      const holidaysSet = new Set<string>();
      for (const spec of balanceTarget.target_specs) {
        if (spec.exclude_holidays && spec.state_code) {
          const country = spec.state_code.split('-')[0];
          const holidays = await this.holidayRepository.find({
            where: { country },
          });
          for (const h of holidays) {
            const dateStr = dayjs(h.date).format('YYYY-MM-DD');
            holidaysSet.add(dateStr);
          }
        }
      }

      // Calculate daily balances for each day
      const dailyBalances: BalanceType[] = [];
      for (let d = rangeStart; d.isSameOrBefore(rangeEnd, 'day'); d = d.add(1, 'day')) {
        const dateStr = d.format('YYYY-MM-DD');
        const year = d.year();
        const month = d.month() + 1;

        // Load timelogs for this month (cache per month would optimize, but acceptable)
        const timelogs = timerIds.length > 0
          ? await this.getTimelogsForDate(timerIds, year, month)
          : [];

        const timelogTypes = timelogs.map(tl => ({
          ...tl,
          start_timestamp: tl.start_timestamp.toISOString(),
          end_timestamp: tl.end_timestamp?.toISOString(),
          created_at: tl.start_timestamp.toISOString(),
          updated_at: tl.start_timestamp.toISOString(),
        }));

        const dueMinutes = calculateDueMinutes(dateStr, balanceTarget, holidaysSet);
        const { worked_minutes, counters } = calculateWorkedMinutesForDate(
          dateStr,
          timelogTypes as any,
          dueMinutes
        );

        const compositeId = generateBalanceId(target.id, dateStr);
        const balance: BalanceType = {
          id: compositeId,
          user_id: userId,
          target_id: target.id,
          date: dateStr,
          due_minutes: dueMinutes,
          worked_minutes: worked_minutes,
          cumulative_minutes: 0,
          sick_days: counters.sick_days,
          holidays: counters.holidays,
          business_trip: counters.business_trip,
          child_sick: counters.child_sick,
          homeoffice: counters.homeoffice,
          worked_days: worked_minutes > 0 ? 1 : 0,
          created_at: dayjs().toISOString(),
          updated_at: dayjs().toISOString(),
        };

        dailyBalances.push(balance);

        // Upsert in database
        await this.upsertBalance(userId, balance);
      }

      // Propagate cumulative on daily
      propagateCumulativeMinutes(dailyBalances, 0);

      // Aggregate monthly
      const monthlyBalances: BalanceType[] = [];
      const monthGroups = new Map<string, BalanceType[]>();
      for (const db of dailyBalances) {
        const monthStr = db.date.substring(0, 7);
        if (!monthGroups.has(monthStr)) monthGroups.set(monthStr, []);
        monthGroups.get(monthStr)!.push(db);
      }

      let monthCumulation = 0;
      const sortedMonths = [...monthGroups.keys()].sort();
      for (const monthStr of sortedMonths) {
        const dailies = monthGroups.get(monthStr)!;
        const agg = aggregateToMonthly(dailies, monthCumulation);
        const compositeId = generateBalanceId(target.id, monthStr);
        const monthBal: BalanceType = {
          id: compositeId,
          ...agg,
          created_at: dayjs().toISOString(),
          updated_at: dayjs().toISOString(),
        };
        monthlyBalances.push(monthBal);
        monthCumulation += (agg.worked_minutes - agg.due_minutes);

        await this.upsertBalance(userId, monthBal);
      }

      // Aggregate yearly
      const yearGroups = new Map<string, BalanceType[]>();
      for (const mb of monthlyBalances) {
        const yearStr = mb.date.substring(0, 4);
        if (!yearGroups.has(yearStr)) yearGroups.set(yearStr, []);
        yearGroups.get(yearStr)!.push(mb);
      }

      let yearCumulation = 0;
      const sortedYears = [...yearGroups.keys()].sort();
      for (const yearStr of sortedYears) {
        const monthlies = yearGroups.get(yearStr)!;
        const agg = aggregateToYearly(monthlies, yearCumulation);
        const compositeId = generateBalanceId(target.id, yearStr);
        const yearBal: BalanceType = {
          id: compositeId,
          ...agg,
          created_at: dayjs().toISOString(),
          updated_at: dayjs().toISOString(),
        };
        yearCumulation += (agg.worked_minutes - agg.due_minutes);

        await this.upsertBalance(userId, yearBal);
      }

      // Build summary from current month
      const currentMonthStr = today.format('YYYY-MM');
      const currentMonthBal = monthlyBalances.find(b => b.date === currentMonthStr);

      if (currentMonthBal) {
        summaries.push({
          targetName: target.name,
          currentMonthDate: currentMonthStr,
          currentMonthDueMinutes: currentMonthBal.due_minutes,
          currentMonthWorkedMinutes: currentMonthBal.worked_minutes,
          currentMonthBalance: currentMonthBal.worked_minutes - currentMonthBal.due_minutes,
          cumulativeMinutes: currentMonthBal.cumulative_minutes + (currentMonthBal.worked_minutes - currentMonthBal.due_minutes),
          sickDays: currentMonthBal.sick_days,
          holidays: currentMonthBal.holidays,
          childSick: currentMonthBal.child_sick,
          workedDays: currentMonthBal.worked_days,
        });
      }
    }

    return summaries;
  }

  /**
   * Load timelogs for given timer IDs in a specific month
   */
  private async getTimelogsForDate(
    timerIds: string[],
    year: number,
    month: number
  ): Promise<TimeLog[]> {
    if (timerIds.length === 0) return [];

    const startOfMonth = dayjs.utc(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month');
    const endOfMonth = startOfMonth.endOf('month');

    return this.timeLogRepository
      .createQueryBuilder('tl')
      .where('tl.timer_id IN (:...timerIds)', { timerIds })
      .andWhere('tl.deleted_at IS NULL')
      .andWhere('tl.start_timestamp <= :endOfMonth', { endOfMonth: endOfMonth.toDate() })
      .andWhere('(tl.end_timestamp IS NULL OR tl.end_timestamp >= :startOfMonth)', {
        startOfMonth: startOfMonth.toDate(),
      })
      .getMany();
  }

  /**
   * Upsert a balance record in the database
   */
  private async upsertBalance(userId: string, balance: BalanceType): Promise<void> {
    const existing = await this.balanceRepository.findOne({
      where: { id: balance.id, user_id: userId },
    });

    if (existing) {
      Object.assign(existing, {
        due_minutes: balance.due_minutes,
        worked_minutes: balance.worked_minutes,
        cumulative_minutes: balance.cumulative_minutes,
        sick_days: balance.sick_days,
        holidays: balance.holidays,
        business_trip: balance.business_trip,
        child_sick: balance.child_sick,
        homeoffice: balance.homeoffice,
        worked_days: balance.worked_days,
      });
      delete (existing as any).updated_at;
      await this.balanceRepository.save(existing);
    } else {
      const entity = this.balanceRepository.create({
        id: balance.id,
        user_id: userId,
        target_id: balance.target_id,
        date: balance.date,
        due_minutes: balance.due_minutes,
        worked_minutes: balance.worked_minutes,
        cumulative_minutes: balance.cumulative_minutes,
        sick_days: balance.sick_days,
        holidays: balance.holidays,
        business_trip: balance.business_trip,
        child_sick: balance.child_sick,
        homeoffice: balance.homeoffice,
        worked_days: balance.worked_days,
      });
      await this.balanceRepository.save(entity);
    }
  }
}
