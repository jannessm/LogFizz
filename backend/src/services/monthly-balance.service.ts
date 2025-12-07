import { AppDataSource } from '../config/database.js';
import { MonthlyBalance } from '../entities/MonthlyBalance.js';
import { MoreThan } from 'typeorm';

export class MonthlyBalanceService {
  private monthlyBalanceRepository = AppDataSource.getRepository(MonthlyBalance);

  /**
   * Get all monthly balances changed since a given timestamp
   * Used for sync functionality
   */
  async getChangedMonthlyBalancesSince(userId: string, since: Date): Promise<MonthlyBalance[]> {
    return this.monthlyBalanceRepository.find({
      where: [
        { user_id: userId, updated_at: MoreThan(since) },
        { user_id: userId, created_at: MoreThan(since) },
      ],
      relations: ['target'],
      order: { updated_at: 'ASC' },
    });
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
}
