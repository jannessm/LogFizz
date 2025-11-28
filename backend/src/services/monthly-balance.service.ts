import { AppDataSource } from '../config/database.js';
import { MonthlyBalance } from '../entities/MonthlyBalance.js';
import { DailyTarget } from '../entities/DailyTarget.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Holiday } from '../entities/Holiday.js';
import { Between, In, MoreThan } from 'typeorm';
import dayjs from '../utils/dayjs.js';

export class MonthlyBalanceService {
  private monthlyBalanceRepository = AppDataSource.getRepository(MonthlyBalance);
  private dailyTargetRepository = AppDataSource.getRepository(DailyTarget);
  private timeLogRepository = AppDataSource.getRepository(TimeLog);
  private holidayRepository = AppDataSource.getRepository(Holiday);

  /**
   * Get all monthly balances changed since a given timestamp
   * Used for sync functionality
   */
  async getChangedMonthlyBalancesSince(userId: string, since: Date): Promise<MonthlyBalance[]> {
    return this.monthlyBalanceRepository.find({
      where: {
        user_id: userId,
        updated_at: MoreThan(since),
      },
      relations: ['target'],
      order: { updated_at: 'ASC' },
    });
  }

  /**
   * Recalculate monthly balances for affected months based on time logs
   * Called after time logs are synced
   * Finds the earliest affected month and recalculates all months from there until today
   * to ensure cumulative balances are correct
   */
  async recalculateAffectedMonthlyBalances(
    userId: string,
    timeLogs: Array<{ timestamp: Date; button_id: string }>
  ): Promise<MonthlyBalance[]> {
    if (timeLogs.length === 0) {
      return [];
    }

    // Find the earliest affected month
    let earliestDate: dayjs.Dayjs | null = null;
    
    for (const log of timeLogs) {
      const date = dayjs(log.timestamp).utc().startOf('month');
      if (!earliestDate || date.isBefore(earliestDate)) {
        earliestDate = date;
      }
    }

    if (!earliestDate) {
      return [];
    }

    // Calculate end date (current month)
    const today = dayjs().utc();
    const endDate = today.startOf('month');

    // Recalculate all months from earliest affected month to current month
    const updatedBalances: MonthlyBalance[] = [];
    let currentMonth = earliestDate;

    while (currentMonth.isBefore(endDate) || currentMonth.isSame(endDate)) {
      const year = currentMonth.year();
      const month = currentMonth.month() + 1; // 1-12
      
      const balances = await this.recalculateMonthBalances(userId, year, month);
      updatedBalances.push(...balances);
      
      // Move to next month
      currentMonth = currentMonth.add(1, 'month');
    }

    return updatedBalances;
  }

  /**
   * Calculate and save monthly balance for a target
   * Includes cumulative balance from previous months (since starting_from)
   * Returns null if target has no starting_from date (no balance calculation possible)
   */
  async calculateMonthlyBalance(
    userId: string,
    targetId: string,
    year: number,
    month: number
  ): Promise<MonthlyBalance | null> {
    // Get the target
    const target = await this.dailyTargetRepository
      .createQueryBuilder('target')
      .where('target.id = :targetId', { targetId })
      .andWhere('target.user_id = :userId', { userId })
      .andWhere('target.deleted_at IS NULL')
      .getOne();

    if (!target) {
      throw new Error('Target not found');
    }

    // Convert weekdays and duration_minutes from strings to numbers (TypeORM simple-array stores as strings)
    target.weekdays = target.weekdays.map((day: any) => typeof day === 'string' ? parseInt(day, 10) : day);
    target.duration_minutes = target.duration_minutes.map((min: any) => typeof min === 'string' ? parseInt(min, 10) : min);

    // Do not calculate balance if no starting_from is set
    const startingFrom = target.starting_from ? dayjs(target.starting_from).utc() : null;
    if (!startingFrom) {
      // Delete any existing balance for this target (shouldn't exist, but clean up)
      await this.monthlyBalanceRepository.delete({
        user_id: userId,
        target_id: targetId,
        year,
        month,
      });
      return null;
    }

    // Calculate date range for the month (month is 1-12)
    const startDate = dayjs.utc(`${year}-${month.toString().padStart(2, '0')}-01`).startOf('day');
    const endDate = startDate.add(1, 'month');

    // Check if this month is before the starting_from date
    if (endDate.isBefore(startingFrom) || endDate.isSame(startingFrom)) {
      // This month is entirely before starting_from, no balance should be calculated
      // Delete any existing balance
      await this.monthlyBalanceRepository.delete({
        user_id: userId,
        target_id: targetId,
        year,
        month,
      });
      return null;
    }

    // Calculate the effective start date for time logs (max of month start or starting_from)
    const effectiveStartDate = startingFrom.isAfter(startDate) ? startingFrom : startDate;

    // Get all time logs for buttons linked to this target in this month (from effective start date)
    // Include button info for auto_subtract_breaks flag
    const timeLogs = await this.timeLogRepository
      .createQueryBuilder('tl')
      .innerJoin('buttons', 'b', 'b.id = tl.button_id')
      .addSelect('b.auto_subtract_breaks', 'auto_subtract_breaks')
      .where('tl.user_id = :userId', { userId })
      .andWhere('b.target_id = :targetId', { targetId })
      .andWhere('tl.timestamp >= :effectiveStartDate', { effectiveStartDate: effectiveStartDate.toDate() })
      .andWhere('tl.timestamp < :endDate', { endDate: endDate.toDate() })
      .andWhere('tl.deleted_at IS NULL')
      .orderBy('tl.timestamp', 'ASC')
      .getRawAndEntities();

    // Calculate worked minutes from time logs (including break subtraction if applicable)
    const workedMinutes = this.calculateWorkedMinutes(timeLogs.entities, timeLogs.raw);

    // Calculate due minutes based on target (respecting starting_from)
    const dueMinutes = await this.calculateDueMinutes(
      target,
      year,
      month,
      target.exclude_holidays,
      userId
    );

    // Calculate this month's balance (worked - due)
    const thisMonthBalance = workedMinutes - dueMinutes;

    // Get cumulative balance from previous month (if within starting_from range)
    const previousMonthBalance = await this.getPreviousMonthCumulativeBalance(
      userId,
      targetId,
      year,
      month,
      startingFrom
    );

    // Total balance = previous cumulative + this month's balance
    const balanceMinutes = previousMonthBalance + thisMonthBalance;

    // Check if balance already exists
    let balance = await this.monthlyBalanceRepository.findOne({
      where: {
        user_id: userId,
        target_id: targetId,
        year,
        month,
      },
    });

    if (balance) {
      // Update existing balance
      balance.worked_minutes = workedMinutes;
      balance.due_minutes = dueMinutes;
      balance.balance_minutes = balanceMinutes;
      balance.exclude_holidays = target.exclude_holidays;
    } else {
      // Create new balance
      balance = this.monthlyBalanceRepository.create({
        user_id: userId,
        target_id: targetId,
        year,
        month,
        worked_minutes: workedMinutes,
        due_minutes: dueMinutes,
        balance_minutes: balanceMinutes,
        exclude_holidays: target.exclude_holidays,
      });
    }

    return await this.monthlyBalanceRepository.save(balance);
  }

  /**
   * Get the cumulative balance from the previous month
   * Returns 0 if there's no previous balance or if before starting_from
   */
  private async getPreviousMonthCumulativeBalance(
    userId: string,
    targetId: string,
    year: number,
    month: number,
    startingFrom: dayjs.Dayjs | null
  ): Promise<number> {
    // Calculate previous month using dayjs
    const currentMonth = dayjs.utc(`${year}-${month.toString().padStart(2, '0')}-01`);
    const previousMonth = currentMonth.subtract(1, 'month');
    const prevYear = previousMonth.year();
    const prevMonth = previousMonth.month() + 1; // dayjs months are 0-indexed

    // Check if previous month is entirely before starting_from
    // We need to check if starting_from is after the END of the previous month
    if (startingFrom) {
      const currentMonthStart = currentMonth.startOf('day');
      if (startingFrom.isAfter(currentMonthStart) || startingFrom.isSame(currentMonthStart)) {
        // starting_from is on or after current month's start,
        // meaning previous month is entirely before tracking began
        return 0;
      }
    }

    // Get previous month's balance
    const previousBalance = await this.monthlyBalanceRepository.findOne({
      where: {
        user_id: userId,
        target_id: targetId,
        year: prevYear,
        month: prevMonth,
      },
    });

    return previousBalance ? previousBalance.balance_minutes : 0;
  }

  /**
   * Calculate total worked minutes from time logs
   * Respects auto_subtract_breaks flag from button if provided in raw data
   * Break calculation: 30 mins after 6h, 45 mins after 9h
   */
  private calculateWorkedMinutes(timeLogs: TimeLog[], rawData?: any[]): number {
    let totalMinutes = 0;
    let lastStart: TimeLog | null = null;
    let lastStartRaw: any = null;

    for (let i = 0; i < timeLogs.length; i++) {
      const log = timeLogs[i];
      const raw = rawData ? rawData[i] : null;
      
      if (log.type === 'start') {
        lastStart = log;
        lastStartRaw = raw;
      } else if (log.type === 'stop' && lastStart) {
        const startTime = dayjs(lastStart.timestamp);
        const stopTime = dayjs(log.timestamp);
        let minutes = stopTime.diff(startTime, 'minute', true);
        
        // Apply break subtraction if auto_subtract_breaks is enabled for the button
        const autoSubtractBreaks = lastStartRaw?.auto_subtract_breaks ?? false;
        if (autoSubtractBreaks && minutes > 0) {
          // German break rules: 30 min after 6h, additional 15 min (total 45) after 9h
          if (minutes >= 9 * 60) {
            minutes -= 45; // 45 minutes break for 9+ hours
          } else if (minutes >= 6 * 60) {
            minutes -= 30; // 30 minutes break for 6-9 hours
          }
        }
        
        totalMinutes += Math.max(0, minutes);
        lastStart = null;
        lastStartRaw = null;
      }
    }

    return Math.round(totalMinutes);
  }

  /**
   * Calculate due minutes based on target and month
   * Respects starting_from date - only counts days on or after starting_from
   */
  private async calculateDueMinutes(
    target: DailyTarget,
    year: number,
    month: number,
    excludeHolidays: boolean,
    userId: string
  ): Promise<number> {
    let totalMinutes = 0;

    // Get holidays if needed
    let holidays: Set<string> = new Set();
    if (excludeHolidays) {
      const holidayRecords = await this.holidayRepository.find({
        where: {
          year,
        },
      });
      holidays = new Set(
        holidayRecords.map((h) => dayjs(h.date).format('YYYY-MM-DD'))
      );
    }

    // Get starting_from date if set
    const startingFrom = target.starting_from ? dayjs(target.starting_from).utc() : null;

    // Iterate through each day of the month using dayjs
    const monthStart = dayjs.utc(`${year}-${month.toString().padStart(2, '0')}-01`);
    const daysInMonth = monthStart.daysInMonth();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = monthStart.date(day);
      const dayOfWeek = date.day(); // 0=Sunday, 6=Saturday
      const dateString = date.format('YYYY-MM-DD');

      // Skip days before starting_from
      if (startingFrom && date.isBefore(startingFrom, 'day')) {
        continue;
      }

      // Check if this day is in the target's weekdays
      if (target.weekdays.includes(dayOfWeek)) {
        // Check if we should exclude this day because it's a holiday
        if (excludeHolidays && holidays.has(dateString)) {
          continue;
        }

        // Get the duration for this day of week
        // duration_minutes array should match weekdays array
        const dayIndex = target.weekdays.indexOf(dayOfWeek);
        if (dayIndex >= 0 && dayIndex < target.duration_minutes.length) {
          totalMinutes += target.duration_minutes[dayIndex];
        }
      }
    }

    return totalMinutes;
  }

  /**
   * Get monthly balance
   */
  async getMonthlyBalance(
    userId: string,
    targetId: string,
    year: number,
    month: number
  ): Promise<MonthlyBalance | null> {
    return await this.monthlyBalanceRepository.findOne({
      where: {
        user_id: userId,
        target_id: targetId,
        year,
        month,
      },
    });
  }

  /**
   * Get all monthly balances for a user in a specific month
   */
  async getAllMonthlyBalances(
    userId: string,
    year: number,
    month: number
  ): Promise<MonthlyBalance[]> {
    return await this.monthlyBalanceRepository.find({
      where: {
        user_id: userId,
        year,
        month,
      },
      relations: ['target'],
    });
  }

  /**
   * Recalculate all balances for a user in a specific month
   */
  async recalculateMonthBalances(
    userId: string,
    year: number,
    month: number
  ): Promise<MonthlyBalance[]> {
    // Get all targets for the user
    const targets = await this.dailyTargetRepository
      .createQueryBuilder('target')
      .where('target.user_id = :userId', { userId })
      .andWhere('target.deleted_at IS NULL')
      .getMany();

    // Calculate balance for each target (only those with starting_from)
    const balances: MonthlyBalance[] = [];
    for (const target of targets) {
      const balance = await this.calculateMonthlyBalance(
        userId,
        target.id,
        year,
        month
      );
      if (balance) {
        balances.push(balance);
      }
    }

    if (balances.length === 0) {
      return [];
    }

    // Reload balances with target relation to include target names
    const balanceIds = balances.map(b => b.id);
    return await this.monthlyBalanceRepository.find({
      where: {
        id: In(balanceIds),
      },
      relations: ['target'],
    });
  }
}
