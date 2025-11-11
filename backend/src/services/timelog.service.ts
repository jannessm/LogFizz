import { AppDataSource } from '../config/database.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Button } from '../entities/Button.js';
import { calculateBreakTime } from '../utils/breaks.js';
import { Between, IsNull, MoreThan } from 'typeorm';

export class TimeLogService {
  private timeLogRepository = AppDataSource.getRepository(TimeLog);
  private buttonRepository = AppDataSource.getRepository(Button);

  async startTimer(userId: string, buttonId: string, timezone?: string): Promise<TimeLog> {
    // Stop any active timers for this user
    await this.stopActiveTimers(userId);

    // Verify button belongs to user
    const button = await this.buttonRepository.findOne({
      where: { id: buttonId, user_id: userId, deleted_at: IsNull() },
    });

    if (!button) {
      throw new Error('Button not found');
    }

    const timeLog = this.timeLogRepository.create({
      user_id: userId,
      button_id: buttonId,
      type: 'start',
      timestamp: new Date(),
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      apply_break_calculation: button.auto_subtract_breaks,
    });

    return this.timeLogRepository.save(timeLog);
  }

  async stopTimer(userId: string, startLogId: string, timezone?: string): Promise<TimeLog> {
    const startLog = await this.timeLogRepository.findOne({
      where: { id: startLogId, user_id: userId, type: 'start', deleted_at: IsNull() },
      relations: ['button'],
    });

    if (!startLog) {
      throw new Error('Start log not found');
    }

    // Check if already stopped (there's a stop entry with same button_id after this start)
    const existingStop = await this.timeLogRepository.findOne({
      where: {
        user_id: userId,
        button_id: startLog.button_id,
        type: 'stop',
        deleted_at: IsNull(),
      },
      order: { timestamp: 'DESC' },
    });

    if (existingStop && existingStop.timestamp > startLog.timestamp) {
      throw new Error('Timer already stopped');
    }

    const stopLog = this.timeLogRepository.create({
      user_id: userId,
      button_id: startLog.button_id,
      type: 'stop',
      timestamp: new Date(),
      timezone: timezone || startLog.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      apply_break_calculation: startLog.apply_break_calculation,
    });

    return this.timeLogRepository.save(stopLog);
  }

  async stopActiveTimers(userId: string): Promise<void> {
    const activeStartLogs = await this.getActiveTimers(userId);

    for (const startLog of activeStartLogs) {
      const stopLog = this.timeLogRepository.create({
        user_id: userId,
        button_id: startLog.button_id,
        type: 'stop',
        timestamp: new Date(),
        apply_break_calculation: startLog.apply_break_calculation,
      });

      await this.timeLogRepository.save(stopLog);
    }
  }

  private async getActiveTimers(userId: string): Promise<TimeLog[]> {
    const startLogs = await this.timeLogRepository.find({
      where: { user_id: userId, type: 'start', deleted_at: IsNull() },
      order: { timestamp: 'DESC' },
    });

    const activeStarts: TimeLog[] = [];

    for (const startLog of startLogs) {
      // Find if there's a stop after this start
      const stopLog = await this.timeLogRepository.findOne({
        where: {
          user_id: userId,
          button_id: startLog.button_id,
          type: 'stop',
          deleted_at: IsNull(),
        },
        order: { timestamp: 'DESC' },
      });

      if (!stopLog || stopLog.timestamp < startLog.timestamp) {
        activeStarts.push(startLog);
      }
    }

    return activeStarts;
  }

  async getActiveTimer(userId: string): Promise<TimeLog | null> {
    const activeTimers = await this.getActiveTimers(userId);
    return activeTimers.length > 0 ? activeTimers[0] : null;
  }

  async getTimeLogs(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    buttonId?: string
  ): Promise<TimeLog[]> {
    const where: any = { user_id: userId, deleted_at: IsNull() };

    if (startDate && endDate) {
      where.timestamp = Between(startDate, endDate);
    }

    if (buttonId) {
      where.button_id = buttonId;
    }

    return this.timeLogRepository.find({
      where,
      relations: ['button'],
      order: { timestamp: 'DESC' },
    });
  }

  async getTodayTimeForButton(userId: string, buttonId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeLogs = await this.timeLogRepository.find({
      where: {
        user_id: userId,
        button_id: buttonId,
        timestamp: Between(today, tomorrow),
        deleted_at: IsNull(),
      },
      order: { timestamp: 'ASC' },
    });

    // Calculate duration from start/stop pairs
    let totalMinutes = 0;
    let currentStart: TimeLog | null = null;

    for (const log of timeLogs) {
      if (log.type === 'start') {
        currentStart = log;
      } else if (log.type === 'stop' && currentStart) {
        const duration = Math.floor((log.timestamp.getTime() - currentStart.timestamp.getTime()) / 1000 / 60);
        
        // Apply break calculation if flag is set
        const breakTime = log.apply_break_calculation ? calculateBreakTime(duration) : 0;
        totalMinutes += duration - breakTime;
        
        currentStart = null;
      }
    }

    return totalMinutes;
  }

  async getYearlyStats(userId: string, year: number): Promise<any> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const timeLogs = await this.timeLogRepository.find({
      where: {
        user_id: userId,
        timestamp: Between(startDate, endDate),
        deleted_at: IsNull(),
      },
      relations: ['button'],
      order: { timestamp: 'ASC' },
    });

    const stats: any = {};
    const buttonStarts: Map<string, TimeLog> = new Map();

    timeLogs.forEach((log) => {
      const buttonName = log.button?.name || 'Unknown';
      
      if (!stats[buttonName]) {
        stats[buttonName] = {
          totalMinutes: 0,
          totalBreakMinutes: 0,
          count: 0,
        };
      }

      if (log.type === 'start') {
        buttonStarts.set(log.button_id, log);
      } else if (log.type === 'stop') {
        const startLog = buttonStarts.get(log.button_id);
        if (startLog) {
          const duration = Math.floor((log.timestamp.getTime() - startLog.timestamp.getTime()) / 1000 / 60);
          const breakTime = log.apply_break_calculation ? calculateBreakTime(duration) : 0;
          
          stats[buttonName].totalMinutes += duration;
          stats[buttonName].totalBreakMinutes += breakTime;
          stats[buttonName].count += 1;
          
          buttonStarts.delete(log.button_id);
        }
      }
    });

    return stats;
  }

  async createManualLog(
    userId: string,
    buttonId: string,
    startTime: Date,
    endTime: Date,
    notes?: string,
    timezone?: string
  ): Promise<{ start: TimeLog; stop: TimeLog }> {
    // Verify button belongs to user
    const button = await this.buttonRepository.findOne({
      where: { id: buttonId, user_id: userId, deleted_at: IsNull() },
    });

    if (!button) {
      throw new Error('Button not found');
    }

    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    const startLog = this.timeLogRepository.create({
      user_id: userId,
      button_id: buttonId,
      type: 'start',
      timestamp: startTime,
      timezone: tz,
      notes,
      is_manual: true,
      apply_break_calculation: button.auto_subtract_breaks,
    });

    const stopLog = this.timeLogRepository.create({
      user_id: userId,
      button_id: buttonId,
      type: 'stop',
      timestamp: endTime,
      timezone: tz,
      notes,
      is_manual: true,
      apply_break_calculation: button.auto_subtract_breaks,
    });

    const savedStart = await this.timeLogRepository.save(startLog);
    const savedStop = await this.timeLogRepository.save(stopLog);

    return { start: savedStart, stop: savedStop };
  }

  async updateTimeLog(
    userId: string,
    timeLogId: string,
    updates: Partial<TimeLog>
  ): Promise<TimeLog | null> {
    const timeLog = await this.timeLogRepository.findOne({
      where: { id: timeLogId, user_id: userId, deleted_at: IsNull() },
    });

    if (!timeLog) {
      return null;
    }

    Object.assign(timeLog, updates);
    return this.timeLogRepository.save(timeLog);
  }

  async deleteTimeLog(userId: string, timeLogId: string): Promise<boolean> {
    const timeLog = await this.timeLogRepository.findOne({
      where: { id: timeLogId, user_id: userId, deleted_at: IsNull() },
    });

    if (!timeLog) {
      return false;
    }

    timeLog.deleted_at = new Date();
    await this.timeLogRepository.save(timeLog);
    return true;
  }

  async getGoalProgress(userId: string, buttonId: string): Promise<any> {
    const button = await this.buttonRepository.findOne({
      where: { id: buttonId, user_id: userId, deleted_at: IsNull() },
    });

    if (!button) {
      throw new Error('Button not found');
    }

    const today = new Date();
    const dayOfWeek = today.getDay();

    // Check if today is a goal day
    const isGoalDay = button.goal_days?.includes(dayOfWeek) || false;

    if (!isGoalDay || !button.goal_time_minutes) {
      return {
        isGoalDay: false,
        goalMinutes: 0,
        actualMinutes: 0,
        progress: 0,
      };
    }

    const actualMinutes = await this.getTodayTimeForButton(userId, buttonId);

    return {
      isGoalDay: true,
      goalMinutes: button.goal_time_minutes,
      actualMinutes,
      progress: (actualMinutes / button.goal_time_minutes) * 100,
      difference: actualMinutes - button.goal_time_minutes,
    };
  }

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
      id: string;
      field: 'timeLog';
      clientVersion: Partial<TimeLog>;
      serverVersion: TimeLog;
    }>;
  }> {
    const savedTimeLogs: TimeLog[] = [];
    const conflicts: Array<{
      id: string;
      field: 'timeLog';
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
                id: existing.id,
                field: 'timeLog',
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
