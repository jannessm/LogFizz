import { AppDataSource } from '../config/database.js';
import { MonthlyBalance } from '../entities/MonthlyBalance.js';
import { DailyTarget } from '../entities/DailyTarget.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Holiday } from '../entities/Holiday.js';
import { Between, In, MoreThan } from 'typeorm';

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
   */
  async recalculateAffectedMonthlyBalances(
    userId: string,
    timeLogs: Array<{ timestamp: Date; button_id: string }>
  ): Promise<MonthlyBalance[]> {
    // Find unique year/month combinations from the time logs
    const affectedMonths = new Set<string>();
    
    for (const log of timeLogs) {
      const date = new Date(log.timestamp);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1; // 1-12
      affectedMonths.add(`${year}-${month}`);
    }

    const updatedBalances: MonthlyBalance[] = [];
    
    for (const monthKey of affectedMonths) {
      const [year, month] = monthKey.split('-').map(Number);
      const balances = await this.recalculateMonthBalances(userId, year, month);
      updatedBalances.push(...balances);
    }

    return updatedBalances;
  }

  /**
   * Calculate and save monthly balance for a target
   */
  async calculateMonthlyBalance(
    userId: string,
    targetId: string,
    year: number,
    month: number
  ): Promise<MonthlyBalance> {
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

    // Calculate date range for the month (month is 1-12)
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    // Get all time logs for buttons linked to this target in this month
    const timeLogs = await this.timeLogRepository
      .createQueryBuilder('tl')
      .innerJoin('buttons', 'b', 'b.id = tl.button_id')
      .where('tl.user_id = :userId', { userId })
      .andWhere('b.target_id = :targetId', { targetId })
      .andWhere('tl.timestamp >= :startDate', { startDate })
      .andWhere('tl.timestamp < :endDate', { endDate })
      .andWhere('tl.deleted_at IS NULL')
      .orderBy('tl.timestamp', 'ASC')
      .getMany();

    // Calculate worked minutes from time logs
    const workedMinutes = this.calculateWorkedMinutes(timeLogs);

    // Calculate due minutes based on target
    const dueMinutes = await this.calculateDueMinutes(
      target,
      year,
      month,
      target.exclude_holidays,
      userId
    );

    // Calculate balance
    const balanceMinutes = workedMinutes - dueMinutes;

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
   * Calculate total worked minutes from time logs
   */
  private calculateWorkedMinutes(timeLogs: TimeLog[]): number {
    let totalMinutes = 0;
    let lastStart: TimeLog | null = null;

    for (const log of timeLogs) {
      if (log.type === 'start') {
        lastStart = log;
      } else if (log.type === 'stop' && lastStart) {
        const startTime = new Date(lastStart.timestamp).getTime();
        const stopTime = new Date(log.timestamp).getTime();
        const minutes = (stopTime - startTime) / (1000 * 60);
        totalMinutes += minutes;
        lastStart = null;
      }
    }

    return Math.round(totalMinutes);
  }

  /**
   * Calculate due minutes based on target and month
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
        holidayRecords.map((h) => new Date(h.date).toISOString().split('T')[0])
      );
    }

    // Iterate through each day of the month
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const dayOfWeek = date.getUTCDay(); // 0=Sunday, 6=Saturday
      const dateString = date.toISOString().split('T')[0];

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

    // Calculate balance for each target
    const balances: MonthlyBalance[] = [];
    for (const target of targets) {
      const balance = await this.calculateMonthlyBalance(
        userId,
        target.id,
        year,
        month
      );
      balances.push(balance);
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
