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
          const timer = await this.timerRepository.save(existing);
          savedTimers.push(timer);
        } else {
          // Timer doesn't exist, create new one with client-provided UUID
          const timer = this.timerRepository.create({
            ...change,
            user_id: userId,
            id: change.id, // Use client-generated UUID
          });
          // Remove updated_at to let TypeORM set it
          delete (timer as any).updated_at;
          const saved = await this.timerRepository.save(timer);
          savedTimers.push(saved);
        }
      } else {
        // Create new timer (no ID provided - shouldn't happen in offline-first)
        const timer = this.timerRepository.create({
          ...change,
          user_id: userId,
        });
        delete (timer as any).updated_at;
        const saved = await this.timerRepository.save(timer);
        savedTimers.push(saved);
      }
    }

    return { saved: savedTimers, conflicts };
  }
}
