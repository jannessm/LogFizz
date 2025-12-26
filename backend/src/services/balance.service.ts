import { AppDataSource } from '../config/database.js';
import { Balance } from '../entities/Balance.js';
import { MoreThan } from 'typeorm';

export class BalanceService {
  private balanceRepository = AppDataSource.getRepository(Balance);

  /**
   * Get all monthly balances changed since a given timestamp
   * Used for sync functionality
   */
  async getChangedBalancesSince(userId: string, since: Date): Promise<Balance[]> {
    return this.balanceRepository.find({
      where: [
        { user_id: userId, updated_at: MoreThan(since) },
        { user_id: userId, created_at: MoreThan(since) },
      ],
      order: { updated_at: 'ASC' },
    });
  }
}
