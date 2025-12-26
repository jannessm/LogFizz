import { AppDataSource } from '../config/database.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Timer } from '../entities/Timer.js';
import { Target } from '../entities/Target.js';
import { MoreThan } from 'typeorm';
import dayjs from '../../../lib/utils/dayjs.js';

export class TimeLogService {
  private timeLogRepository = AppDataSource.getRepository(TimeLog);
  private timerRepository = AppDataSource.getRepository(Timer);
  private targetRepository = AppDataSource.getRepository(Target);

  /**
   * Get all time logs (including soft-deleted) changed since a given timestamp
   * Used for sync functionality
   */
  async getChangedTimeLogsSince(userId: string, since: Date): Promise<TimeLog[]> {
    return this.timeLogRepository.find({
      where: [
        { user_id: userId, updated_at: MoreThan(since) },
        { user_id: userId, created_at: MoreThan(since) },
      ],
      order: { updated_at: 'ASC' },
    });
  }

  /**
   * Calculate duration for a time log based on its type
   * For special types (sick, holiday, etc.), calculate based on daily target
   * For normal type, preserve provided duration or calculate from start/end timestamps
   */
  private async calculateDuration(timeLog: Partial<TimeLog>): Promise<number | undefined> {
    const type = timeLog.type || 'normal'; // Default to 'normal' if not specified

    // For normal type, use provided duration_minutes if available
    if (type === 'normal') {
      // If duration is already provided, use it
      if (timeLog.duration_minutes !== undefined && timeLog.duration_minutes !== null) {
        return timeLog.duration_minutes;
      }
      // Otherwise, calculate from timestamps if both are available
      if (timeLog.end_timestamp && timeLog.start_timestamp) {
        const startTime = dayjs(timeLog.start_timestamp);
        const endTime = dayjs(timeLog.end_timestamp);
        return endTime.diff(startTime, 'minute');
      }
      return undefined;
    }

    // For special types, get the daily target duration for this day
    if (timeLog.timer_id && timeLog.start_timestamp) {
      // Get the timer to find its target_id
      const timer = await this.timerRepository.findOne({
        where: { id: timeLog.timer_id },
      });

      if (!timer || !timer.target_id) {
        // No target assigned, return 0
        return 0;
      }

      // Get the target
      const target = await this.targetRepository.findOne({
        where: { id: timer.target_id },
      });

      if (!target) {
        return 0;
      }

      // Get the weekday of the timelog (0=Sunday, 6=Saturday)
      const date = dayjs(timeLog.start_timestamp);
      const weekday = date.day();

      // Note: Target structure has changed, this logic may need to be updated
      // based on the new target_spec_ids system
      // For now, return 0 as a placeholder
      return 0;
    }

    return undefined;
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
      // Calculate duration for the timelog only for special types
      // For normal type, preserve the provided duration_minutes
      const type = change.type || 'normal';
      if (type !== 'normal') {
        const duration = await this.calculateDuration(change);
        if (duration !== undefined) {
          change.duration_minutes = duration;
        }
      }

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
