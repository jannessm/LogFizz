import { AppDataSource } from '../config/database.js';
import { DailyTarget } from '../entities/DailyTarget.js';
import { Button } from '../entities/Button.js';
import { IsNull, MoreThan } from 'typeorm';
import dayjs from '../utils/dayjs.js';

export class DailyTargetService {
  private targetRepository = AppDataSource.getRepository(DailyTarget);
  private buttonRepository = AppDataSource.getRepository(Button);

  /**
   * Get all targets (including soft-deleted) changed since a given timestamp
   * Used for sync functionality
   */
  async getChangedTargetsSince(userId: string, since: Date): Promise<DailyTarget[]> {
    const targets = await this.targetRepository.find({
      where: [
        { user_id: userId, updated_at: MoreThan(since) },
        { user_id: userId, created_at: MoreThan(since) },
      ],
      order: { updated_at: 'ASC' },
    });
    // Convert weekdays from string[] to number[] (TypeORM simple-array stores as strings)
    return targets.map(target => ({
      ...target,
      weekdays: target.weekdays.map((day: any) => typeof day === 'string' ? parseInt(day, 10) : day)
    }));
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
      clientVersion: Partial<DailyTarget>;
      serverVersion: DailyTarget;
    }>;
  }> {
    const savedTargets: DailyTarget[] = [];
    const conflicts: Array<{
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
            const clientTimestamp = dayjs(change.updated_at);
            const serverTimestamp = dayjs(existing.updated_at);
            if (serverTimestamp.isAfter(clientTimestamp)) {
              // Server has newer data - conflict detected
              // Convert weekdays and duration_minutes from strings to numbers for the conflict
              existing.weekdays = existing.weekdays.map((day: any) => typeof day === 'string' ? parseInt(day, 10) : day);
              existing.duration_minutes = existing.duration_minutes.map((min: any) => typeof min === 'string' ? parseInt(min, 10) : min);
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
          const target = await this.targetRepository.save(existing);
          savedTargets.push(target);
        } else {
          // Target doesn't exist, create new one with client-provided UUID
          const target = this.targetRepository.create({
            ...change,
            user_id: userId,
            id: change.id, // Use client-generated UUID
            exclude_holidays: change.exclude_holidays ?? false, // Ensure default value
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
          exclude_holidays: change.exclude_holidays ?? false, // Ensure default value
        });
        delete (target as any).updated_at;
        const saved = await this.targetRepository.save(target);
        savedTargets.push(saved);
      }
    }

    // Convert weekdays and duration_minutes from strings to numbers for all saved targets
    const convertedSavedTargets = savedTargets.map(target => ({
      ...target,
      weekdays: target.weekdays.map((day: any) => typeof day === 'string' ? parseInt(day, 10) : day),
      duration_minutes: target.duration_minutes.map((min: any) => typeof min === 'string' ? parseInt(min, 10) : min)
    }));

    return { saved: convertedSavedTargets, conflicts };
  }
}
