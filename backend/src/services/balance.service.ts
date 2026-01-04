import { AppDataSource } from '../config/database.js';
import { Balance } from '../entities/Balance.js';
import { MoreThan } from 'typeorm';
import dayjs from '../../../lib/utils/dayjs.js';

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
   * Push bulk changes to balances (create or update) with conflict detection
   * Returns conflicts if any exist, otherwise returns saved balances
   */
  async pushBalanceChanges(
    userId: string,
    changes: Array<Partial<Balance> & { updated_at?: Date }>
  ): Promise<{
    saved: Balance[];
    conflicts: Array<{
      clientVersion: Partial<Balance>;
      serverVersion: Balance;
    }>;
  }> {
    const savedBalances: Balance[] = [];
    const conflicts: Array<{
      clientVersion: Partial<Balance>;
      serverVersion: Balance;
    }> = [];

    for (const change of changes) {
      if (change.id) {
        // Check if balance exists on server
        const existing = await this.balanceRepository.findOne({
          where: { id: change.id, user_id: userId },
        });

        if (existing) {
          // Conflict detection: Check if server version is newer than client version
          if (change.updated_at) {
            const clientTimestamp = dayjs(change.updated_at);
            const serverTimestamp = dayjs(existing.updated_at);
            if (serverTimestamp.isAfter(clientTimestamp)) {
              // Server has newer data - conflict detected
              conflicts.push({
                clientVersion: change,
                serverVersion: existing,
              });
              continue; // Skip saving this record
            }
          }

          // No conflict or client is newer - update
          Object.assign(existing, change);
          // Remove updated_at from client to let TypeORM auto-update it
          delete (existing as any).updated_at;
          // Convert empty string to null for next_balance_id
          if (existing.next_balance_id === '') {
            existing.next_balance_id = null;
          }
          const balance = await this.balanceRepository.save(existing);
          savedBalances.push(balance);
        } else {
          // Balance doesn't exist, create new one with client-provided UUID
          
          const balance = this.balanceRepository.create({
            ...change,
            user_id: userId,
            id: change.id, // Use client-generated UUID
          });
          console.log('Creating new balance with ID:', balance);
          // Remove updated_at to let TypeORM set it
          delete (change as any).updated_at;
          // Convert empty string to null for next_balance_id
          if (balance.next_balance_id === '') {
            balance.next_balance_id = null;
          }
          const saved = await this.balanceRepository.save(balance);
          savedBalances.push(saved);
        }
      } else {
        // Create new balance (no ID provided - shouldn't happen in offline-first)
        const balance = this.balanceRepository.create({
          ...change,
          user_id: userId,
        });
        delete (balance as any).updated_at;
        const saved = await this.balanceRepository.save(balance);
        savedBalances.push(saved);
      }
    }

    return { saved: savedBalances, conflicts };
  }
}
