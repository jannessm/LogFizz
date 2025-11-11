import { AppDataSource } from '../config/database';
import { TimeLog } from '../entities/TimeLog';
import { Button } from '../entities/Button';
import { calculateBreakTime } from '../utils/breaks';
import { Between, IsNull } from 'typeorm';

export class TimeLogService {
  private timeLogRepository = AppDataSource.getRepository(TimeLog);
  private buttonRepository = AppDataSource.getRepository(Button);

  async startTimer(userId: string, buttonId: string): Promise<TimeLog> {
    // Stop any active timers for this user
    await this.stopActiveTimers(userId);

    // Verify button belongs to user
    const button = await this.buttonRepository.findOne({
      where: { id: buttonId, user_id: userId },
    });

    if (!button) {
      throw new Error('Button not found');
    }

    const timeLog = this.timeLogRepository.create({
      user_id: userId,
      button_id: buttonId,
      start_time: new Date(),
    });

    return this.timeLogRepository.save(timeLog);
  }

  async stopTimer(userId: string, timeLogId: string): Promise<TimeLog> {
    const timeLog = await this.timeLogRepository.findOne({
      where: { id: timeLogId, user_id: userId },
      relations: ['button'],
    });

    if (!timeLog) {
      throw new Error('Time log not found');
    }

    if (timeLog.end_time) {
      throw new Error('Timer already stopped');
    }

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - timeLog.start_time.getTime()) / 1000 / 60); // in minutes

    timeLog.end_time = endTime;
    timeLog.duration = duration;

    // Apply automatic break calculation if enabled
    if (timeLog.button?.auto_subtract_breaks) {
      const breakTime = calculateBreakTime(duration);
      timeLog.break_time_subtracted = breakTime;
    }

    return this.timeLogRepository.save(timeLog);
  }

  async stopActiveTimers(userId: string): Promise<void> {
    const activeTimeLogs = await this.timeLogRepository.find({
      where: { user_id: userId, end_time: IsNull() },
      relations: ['button'],
    });

    for (const timeLog of activeTimeLogs) {
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - timeLog.start_time.getTime()) / 1000 / 60);

      timeLog.end_time = endTime;
      timeLog.duration = duration;

      if (timeLog.button?.auto_subtract_breaks) {
        timeLog.break_time_subtracted = calculateBreakTime(duration);
      }

      await this.timeLogRepository.save(timeLog);
    }
  }

  async getActiveTimer(userId: string): Promise<TimeLog | null> {
    return this.timeLogRepository.findOne({
      where: { user_id: userId, end_time: IsNull() },
      relations: ['button'],
    });
  }

  async getTimeLogs(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    buttonId?: string
  ): Promise<TimeLog[]> {
    const where: any = { user_id: userId };

    if (startDate && endDate) {
      where.start_time = Between(startDate, endDate);
    }

    if (buttonId) {
      where.button_id = buttonId;
    }

    return this.timeLogRepository.find({
      where,
      relations: ['button'],
      order: { start_time: 'DESC' },
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
        start_time: Between(today, tomorrow),
      },
    });

    return timeLogs.reduce((total, log) => {
      if (log.duration) {
        return total + log.duration - log.break_time_subtracted;
      }
      return total;
    }, 0);
  }

  async getYearlyStats(userId: string, year: number): Promise<any> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const timeLogs = await this.timeLogRepository.find({
      where: {
        user_id: userId,
        start_time: Between(startDate, endDate),
      },
      relations: ['button'],
    });

    const stats: any = {};

    timeLogs.forEach((log) => {
      const buttonName = log.button?.name || 'Unknown';
      if (!stats[buttonName]) {
        stats[buttonName] = {
          totalMinutes: 0,
          totalBreakMinutes: 0,
          count: 0,
        };
      }

      if (log.duration) {
        stats[buttonName].totalMinutes += log.duration;
        stats[buttonName].totalBreakMinutes += log.break_time_subtracted;
        stats[buttonName].count += 1;
      }
    });

    return stats;
  }

  async createManualLog(
    userId: string,
    buttonId: string,
    startTime: Date,
    endTime: Date,
    notes?: string
  ): Promise<TimeLog> {
    // Verify button belongs to user
    const button = await this.buttonRepository.findOne({
      where: { id: buttonId, user_id: userId },
    });

    if (!button) {
      throw new Error('Button not found');
    }

    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000 / 60);

    const timeLog = this.timeLogRepository.create({
      user_id: userId,
      button_id: buttonId,
      start_time: startTime,
      end_time: endTime,
      duration,
      notes,
      is_manual: true,
      break_time_subtracted: button.auto_subtract_breaks ? calculateBreakTime(duration) : 0,
    });

    return this.timeLogRepository.save(timeLog);
  }

  async updateTimeLog(
    userId: string,
    timeLogId: string,
    updates: Partial<TimeLog>
  ): Promise<TimeLog | null> {
    const timeLog = await this.timeLogRepository.findOne({
      where: { id: timeLogId, user_id: userId },
    });

    if (!timeLog) {
      return null;
    }

    // Recalculate duration if times changed
    if (updates.start_time || updates.end_time) {
      const startTime = updates.start_time || timeLog.start_time;
      const endTime = updates.end_time || timeLog.end_time;
      
      if (endTime) {
        updates.duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000 / 60);
      }
    }

    Object.assign(timeLog, updates);
    return this.timeLogRepository.save(timeLog);
  }

  async deleteTimeLog(userId: string, timeLogId: string): Promise<boolean> {
    const result = await this.timeLogRepository.delete({
      id: timeLogId,
      user_id: userId,
    });
    return (result.affected || 0) > 0;
  }

  async getGoalProgress(userId: string, buttonId: string): Promise<any> {
    const button = await this.buttonRepository.findOne({
      where: { id: buttonId, user_id: userId },
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
}
