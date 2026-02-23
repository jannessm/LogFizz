import { AppDataSource } from '../config/database.js';
import { Timer } from '../entities/Timer.js';
import { MoreThan } from 'typeorm';
import dayjs from '../../../lib/utils/dayjs.js';

export class TimerService {
  private timerRepository = AppDataSource.getRepository(Timer);

  /**
   * Get all timers (including soft-deleted) changed since a given timestamp
   * Used for sync functionality
   */
  async getChangedTimersSince(userId: string, since: Date): Promise<Timer[]> {
    // Include records where either updated_at or created_at is greater than `since`.
    // Some DBs may have limited timestamp resolution; checking created_at ensures newly
    // created rows after the cursor are not missed.
    return this.timerRepository.find({
      where: [
        { user_id: userId, updated_at: MoreThan(since) },
        { user_id: userId, created_at: MoreThan(since) },
      ],
      order: { updated_at: 'ASC' },
    });
  }

  /**
   * Push bulk changes to timers (create or update) with conflict detection
   * Returns conflicts if any exist, otherwise returns saved timers
   */
  async pushTimerChanges(
    userId: string, 
    changes: Array<Partial<Timer> & { updated_at?: Date }>
  ): Promise<{
    saved: Timer[];
    conflicts: Array<{
      clientVersion: Partial<Timer>;
      serverVersion: Timer;
    }>;
  }> {
    const savedTimers: Timer[] = [];
    const conflicts: Array<{
      clientVersion: Partial<Timer>;
      serverVersion: Timer;
    }> = [];

    for (const change of changes) {
      if (change.id) {
        // Check if timer exists on server
        const existing = await this.timerRepository.findOne({
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
          // Handle empty string target_id - normalise to null
          if (existing.target_id === '') {
            existing.target_id = undefined;
          }
          // TypeORM's save() silently skips setting a nullable FK column to NULL
          // when the value is null/undefined on the entity. Force it with a direct
          // UPDATE so that an explicit "remove target" operation is persisted.
          if ('target_id' in change && (change.target_id === null || change.target_id === '' || change.target_id === undefined)) {
            await this.timerRepository
              .createQueryBuilder()
              .update(Timer)
              .set({ target_id: null as any })
              .where('id = :id', { id: existing.id })
              .execute();
          }
          await this.timerRepository.save(existing);
          // Reload to get auto-generated timestamps
          const timer = await this.timerRepository.findOne({ where: { id: existing.id } });
          if (timer) savedTimers.push(timer);
        } else {
          // Timer doesn't exist, create new one with client-provided UUID
          const timerData = {
            ...change,
            user_id: userId,
            id: change.id, // Use client-generated UUID
          };
          // Handle null target_id - convert empty string to undefined
          if (timerData.target_id === '') {
            timerData.target_id = undefined;
          }
          const timer = this.timerRepository.create(timerData);
          // Remove updated_at to let TypeORM set it
          delete (timer as any).updated_at;
          await this.timerRepository.save(timer);
          // Reload to get auto-generated timestamps
          const saved = await this.timerRepository.findOne({ where: { id: timer.id } });
          if (saved) savedTimers.push(saved);
        }
      } else {
        // Create new timer (no ID provided - shouldn't happen in offline-first)
        const timerData = {
          ...change,
          user_id: userId,
        };
        // Handle null target_id - convert empty string to undefined
        if (timerData.target_id === '') {
          timerData.target_id = undefined;
        }
        const timer = this.timerRepository.create(timerData);
        delete (timer as any).updated_at;
        await this.timerRepository.save(timer);
        // Reload to get auto-generated timestamps
        const saved = await this.timerRepository.findOne({ where: { id: timer.id } });
        if (saved) savedTimers.push(saved);
      }
    }

    return { saved: savedTimers, conflicts };
  }
}
