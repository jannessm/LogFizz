import { AppDataSource } from '../config/database.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Button } from '../entities/Button.js';
import { MoreThan } from 'typeorm';

export class TimeLogService {
  private timeLogRepository = AppDataSource.getRepository(TimeLog);
  private buttonRepository = AppDataSource.getRepository(Button);

  /**
   * Get all time logs (including soft-deleted) changed since a given timestamp
   * Used for sync functionality
   */
  async getChangedTimeLogsSince(userId: string, since: Date): Promise<TimeLog[]> {
    return this.timeLogRepository.find({
      where: {
        user_id: userId,
        updated_at: MoreThan(since),
      },
      order: { updated_at: 'ASC' },
    });
  }

  /**
   * Push bulk changes to time logs (create or update) with conflict detection
   * Returns conflicts if any exist, otherwise returns saved time logs
   */
  async pushTimeLogChanges(
    userId: string, 
    changes: Array<Partial<TimeLog> & { updated_at?: Date }>
  ): Promise<{
    saved: TimeLog[];
    conflicts: Array<{
      clientVersion: Partial<TimeLog>;
      serverVersion: TimeLog;
    }>;
  }> {
    const savedTimeLogs: TimeLog[] = [];
    const conflicts: Array<{
      clientVersion: Partial<TimeLog>;
      serverVersion: TimeLog;
    }> = [];

    for (const change of changes) {
      if (change.id) {
        // Check if time log exists on server
        const existing = await this.timeLogRepository.findOne({
          where: { id: change.id, user_id: userId },
        });

        if (existing) {
          // Conflict detection: Check if server version is newer than client version
          if (change.updated_at) {
            const clientTimestamp = new Date(change.updated_at);
            if (existing.updated_at > clientTimestamp) {
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
          const timeLog = await this.timeLogRepository.save(existing);
          savedTimeLogs.push(timeLog);
        } else {
          // Time log doesn't exist, create new one with client-provided UUID
          const timeLog = this.timeLogRepository.create({
            ...change,
            user_id: userId,
            id: change.id, // Use client-generated UUID
          });
          // Remove updated_at to let TypeORM set it
          delete (timeLog as any).updated_at;
          const saved = await this.timeLogRepository.save(timeLog);
          savedTimeLogs.push(saved);
        }
      } else {
        // Create new time log (no ID provided - shouldn't happen in offline-first)
        const timeLog = this.timeLogRepository.create({
          ...change,
          user_id: userId,
        });
        delete (timeLog as any).updated_at;
        const saved = await this.timeLogRepository.save(timeLog);
        savedTimeLogs.push(saved);
      }
    }

    return { saved: savedTimeLogs, conflicts };
  }
}
