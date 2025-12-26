import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { Timer } from '../entities/Timer.js';
import { TimeLog } from '../entities/TimeLog.js';
import { IsNull, MoreThan, Not } from 'typeorm';

export interface SystemStatistics {
  users: {
    total: number;
    active: number; // Users who logged time in last 30 days
    new: number; // Users created in last 30 days
  };
  timers: {
    total: number;
    average_per_user: number;
  };
  timeLogs: {
    total: number;
    last_30_days: number;
    total_hours_tracked: number;
    total_hours_last_30_days: number;
  };
  activity: {
    most_active_user: {
      name: string;
      email: string;
      hours_tracked: number;
    } | null;
    most_used_timer: {
      name: string;
      emoji?: string;
      usage_count: number;
    } | null;
  };
}

export class StatisticsService {
  private userRepository = AppDataSource.getRepository(User);
  private timerRepository = AppDataSource.getRepository(Timer);
  private timeLogRepository = AppDataSource.getRepository(TimeLog);

  /**
   * Generate comprehensive system-wide statistics
   * 
   * Note: This method performs calculations in-memory and may not be suitable
   * for systems with very large datasets (>100k time logs). For production systems
   * with large amounts of data, consider implementing database-level aggregations
   * or pagination.
   */
  async generateSystemStatistics(): Promise<SystemStatistics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // User statistics
    const totalUsers = await this.userRepository.count({
      where: { deleted_at: IsNull() },
    });

    const newUsers = await this.userRepository.count({
      where: {
        deleted_at: IsNull(),
        created_at: MoreThan(thirtyDaysAgo),
      },
    });

    // Get active users (users who have logged time in last 30 days)
    const activeUserIds = await this.timeLogRepository
      .createQueryBuilder('tl')
      .select('DISTINCT tl.user_id')
      .where('tl.start_timestamp > :thirtyDaysAgo', { thirtyDaysAgo })
      .andWhere('tl.deleted_at IS NULL')
      .getRawMany();

    const activeUsers = activeUserIds.length;

    // Timer statistics
    const totalTimers = await this.timerRepository.count({
      where: { deleted_at: IsNull() },
    });

    const averageTimersPerUser = totalUsers > 0 ? totalTimers / totalUsers : 0;

    // Time log statistics
    const totalTimeLogs = await this.timeLogRepository.count({
      where: { deleted_at: IsNull() },
    });

    const timeLogsLast30Days = await this.timeLogRepository.count({
      where: {
        deleted_at: IsNull(),
        start_timestamp: MoreThan(thirtyDaysAgo),
      },
    });

    // Calculate total hours tracked
    const totalHours = await this.calculateTotalHours();
    const totalHoursLast30Days = await this.calculateTotalHours(thirtyDaysAgo);

    // Activity statistics
    const mostActiveUser = await this.getMostActiveUser();
    const mostUsedTimer = await this.getMostUsedTimer();

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        new: newUsers,
      },
      timers: {
        total: totalTimers,
        average_per_user: parseFloat(averageTimersPerUser.toFixed(2)),
      },
      timeLogs: {
        total: totalTimeLogs,
        last_30_days: timeLogsLast30Days,
        total_hours_tracked: parseFloat(totalHours.toFixed(2)),
        total_hours_last_30_days: parseFloat(totalHoursLast30Days.toFixed(2)),
      },
      activity: {
        most_active_user: mostActiveUser,
        most_used_timer: mostUsedTimer,
      },
    };
  }

  /**
   * Calculate total hours tracked from time logs
   */
  private async calculateTotalHours(since?: Date): Promise<number> {
    const queryBuilder = this.timeLogRepository
      .createQueryBuilder('tl')
      .where('tl.deleted_at IS NULL')
      .andWhere('tl.end_timestamp IS NOT NULL'); // Only count completed sessions

    if (since) {
      queryBuilder.andWhere('tl.start_timestamp > :since', { since });
    }

    const timeLogs = await queryBuilder.getMany();

    let totalMinutes = 0;
    for (const log of timeLogs) {
      if (log.duration_minutes) {
        totalMinutes += log.duration_minutes;
      } else if (log.end_timestamp) {
        // Calculate if duration wasn't pre-calculated
        const duration = log.end_timestamp.getTime() - log.start_timestamp.getTime();
        totalMinutes += duration / (1000 * 60);
      }
    }

    return totalMinutes / 60; // Convert to hours
  }

  /**
   * Get the most active user (by hours tracked)
   */
  private async getMostActiveUser(): Promise<{
    name: string;
    email: string;
    hours_tracked: number;
  } | null> {
    const users = await this.userRepository.find({
      where: { deleted_at: IsNull() },
    });

    let mostActiveUser = null;
    let maxHours = 0;

    for (const user of users) {
      const timeLogs = await this.timeLogRepository.find({
        where: {
          user_id: user.id,
          deleted_at: IsNull(),
          end_timestamp: Not(IsNull()),
        },
      });

      let userMinutes = 0;
      for (const log of timeLogs) {
        if (log.duration_minutes) {
          userMinutes += log.duration_minutes;
        } else if (log.end_timestamp) {
          const duration = log.end_timestamp.getTime() - log.start_timestamp.getTime();
          userMinutes += duration / (1000 * 60);
        }
      }

      const userHours = userMinutes / 60;
      if (userHours > maxHours) {
        maxHours = userHours;
        mostActiveUser = {
          name: user.name,
          email: user.email,
          hours_tracked: parseFloat(userHours.toFixed(2)),
        };
      }
    }

    return mostActiveUser;
  }

  /**
   * Get the most used timer (by number of time log entries)
   */
  private async getMostUsedTimer(): Promise<{
    name: string;
    emoji?: string;
    usage_count: number;
  } | null> {
    const result = await this.timeLogRepository
      .createQueryBuilder('tl')
      .select('tl.timer_id', 'timer_id')
      .addSelect('COUNT(*)', 'usage_count')
      .where('tl.deleted_at IS NULL')
      .groupBy('tl.timer_id')
      .orderBy('usage_count', 'DESC')
      .limit(1)
      .getRawOne();

    if (!result) {
      return null;
    }

    const timer = await this.timerRepository.findOne({
      where: { id: result.timer_id },
    });

    if (!timer) {
      return null;
    }

    return {
      name: timer.name,
      emoji: timer.emoji,
      usage_count: parseInt(result.usage_count),
    };
  }
}
