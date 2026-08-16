import { AppDataSource } from '../config/database.js';
import { Balance } from '../entities/Balance.js';
import { MoreThan } from 'typeorm';
import { generateBalanceId } from '../../../lib/types/index.js';

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

  /**
   * Push bulk changes to balances (create or update).
   * The client is always the source of truth for balance data — no conflict
   * detection is performed so that recalculated balances are never rejected.
   * Balance IDs are composite: {target_id}_{date}
   */
  async pushBalanceChanges(
    userId: string,
    changes: Array<Partial<Balance> & { updated_at?: Date }>
  ): Promise<{ saved: Balance[] }> {
    const savedBalances: Balance[] = [];

    for (const originalChange of changes) {
      // Work on a shallow copy to avoid mutating the caller's input
      const change = { ...originalChange };

      // Generate composite ID from target_id and date
      const compositeId = change.target_id && change.date 
        ? generateBalanceId(change.target_id, change.date)
        : change.id;

      if (!compositeId) {
        console.error('Cannot create balance without target_id and date');
        continue;
      }

      // Remove timestamps to let TypeORM manage them
      delete (change as any).updated_at;
      delete (change as any).created_at;
      delete (change as any).deleted_at;

      // Upsert: try to find existing, then save
      const existing = await this.balanceRepository.findOne({
        where: { id: compositeId, user_id: userId },
      });

      if (existing) {
        // Always apply client data — client recalculation wins
        Object.assign(existing, change);
        existing.id = compositeId;
        existing.user_id = userId;
        const saved = await this.balanceRepository.save(existing);
        savedBalances.push(saved);
      } else {
        // Balance doesn't exist, create new one with composite ID
        const balance = this.balanceRepository.create({
          ...change,
          user_id: userId,
          id: compositeId,
        });
        const saved = await this.balanceRepository.save(balance);
        savedBalances.push(saved);
      }
    }

    return { saved: savedBalances };
  }
}
