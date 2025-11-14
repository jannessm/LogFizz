import { AppDataSource } from '../config/database.js';
import { DailyTarget } from '../entities/DailyTarget.js';
import { IsNull, MoreThan } from 'typeorm';

export class DailyTargetService {
  private targetRepository = AppDataSource.getRepository(DailyTarget);

  async createTarget(userId: string, data: Partial<DailyTarget>): Promise<DailyTarget> {
    // Remove timestamp fields to let TypeORM manage them automatically
    const dataWithoutTimestamps: any = { ...data };
    delete dataWithoutTimestamps.created_at;
    delete dataWithoutTimestamps.updated_at;
    
    const target: DailyTarget = this.targetRepository.create({
      ...dataWithoutTimestamps,
      user_id: userId,
    } as Partial<DailyTarget>);

    return this.targetRepository.save(target);
  }

  async getUserTargets(userId: string): Promise<DailyTarget[]> {
    return this.targetRepository.find({
      where: { user_id: userId, deleted_at: IsNull() },
      order: { created_at: 'ASC' },
    });
  }

  async getTargetById(id: string, userId: string): Promise<DailyTarget | null> {
    return this.targetRepository.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
  }

  async updateTarget(id: string, userId: string, updates: Partial<DailyTarget>): Promise<DailyTarget | null> {
    const target = await this.getTargetById(id, userId);
    if (!target) {
      return null;
    }

    Object.assign(target, updates);
    return this.targetRepository.save(target);
  }

  async deleteTarget(id: string, userId: string): Promise<boolean> {
    const target = await this.getTargetById(id, userId);
    if (!target) {
      return false;
    }

    target.deleted_at = new Date();
    await this.targetRepository.save(target);
    return true;
  }

  /**
   * Get all targets (including soft-deleted) changed since a given timestamp
   * Used for sync functionality
   */
  async getChangedTargetsSince(userId: string, since: Date): Promise<DailyTarget[]> {
    return this.targetRepository.find({
      where: {
        user_id: userId,
        updated_at: MoreThan(since),
      },
      order: { updated_at: 'ASC' },
    });
  }

  /**
   * Push bulk changes to targets (create or update) with conflict detection
   * Returns conflicts if any exist, otherwise returns saved targets
   */
  async pushTargetChanges(
    userId: string, 
    changes: Array<Partial<DailyTarget> & { updated_at?: Date }>
  ): Promise<{
    saved: DailyTarget[];
    conflicts: Array<{
      id: string;
      field: 'daily_target';
      clientVersion: Partial<DailyTarget>;
      serverVersion: DailyTarget;
    }>;
  }> {
    const savedTargets: DailyTarget[] = [];
    const conflicts: Array<{
      id: string;
      field: 'daily_target';
      clientVersion: Partial<DailyTarget>;
      serverVersion: DailyTarget;
    }> = [];

    for (const change of changes) {
      if (change.id) {
        // Check if target exists on server
        const existing = await this.targetRepository.findOne({
          where: { id: change.id, user_id: userId },
        });

        if (existing) {
          // Conflict detection: Check if server version is newer than client version
          if (change.updated_at) {
            const clientTimestamp = new Date(change.updated_at);
            if (existing.updated_at > clientTimestamp) {
              // Server has newer data - conflict detected
              conflicts.push({
                id: existing.id,
                field: 'daily_target',
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
          const target = await this.targetRepository.save(existing);
          savedTargets.push(target);
        } else {
          // Target doesn't exist, create new one with client-provided UUID
          const target = this.targetRepository.create({
            ...change,
            user_id: userId,
            id: change.id, // Use client-generated UUID
          });
          // Remove updated_at to let TypeORM set it
          delete (target as any).updated_at;
          const saved = await this.targetRepository.save(target);
          savedTargets.push(saved);
        }
      } else {
        // Create new target (no ID provided - shouldn't happen in offline-first)
        const target = this.targetRepository.create({
          ...change,
          user_id: userId,
        });
        delete (target as any).updated_at;
        const saved = await this.targetRepository.save(target);
        savedTargets.push(saved);
      }
    }

    return { saved: savedTargets, conflicts };
  }
}
