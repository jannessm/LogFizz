import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { Button } from '../entities/Button.js';
import { TimeLog } from '../entities/TimeLog.js';
import { IsNull, MoreThan } from 'typeorm';

export interface SystemStatistics {
  users: {
    total: number;
    active: number; // Users who logged time in last 30 days
    new: number; // Users created in last 30 days
  };
  buttons: {
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
    most_used_button: {
      name: string;
      emoji?: string;
      usage_count: number;
    } | null;
  };
}

export class StatisticsService {
  private userRepository = AppDataSource.getRepository(User);
  private buttonRepository = AppDataSource.getRepository(Button);
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
      .where('tl.timestamp > :thirtyDaysAgo', { thirtyDaysAgo })
      .andWhere('tl.deleted_at IS NULL')
      .getRawMany();

    const activeUsers = activeUserIds.length;

    // Button statistics
    const totalButtons = await this.buttonRepository.count({
      where: { deleted_at: IsNull() },
    });

    const averageButtonsPerUser = totalUsers > 0 ? totalButtons / totalUsers : 0;

    // Time log statistics
    const totalTimeLogs = await this.timeLogRepository.count({
      where: { deleted_at: IsNull() },
    });

    const timeLogsLast30Days = await this.timeLogRepository.count({
      where: {
        deleted_at: IsNull(),
        timestamp: MoreThan(thirtyDaysAgo),
      },
    });

    // Calculate total hours tracked
    const totalHours = await this.calculateTotalHours();
    const totalHoursLast30Days = await this.calculateTotalHours(thirtyDaysAgo);

    // Activity statistics
    const mostActiveUser = await this.getMostActiveUser();
    const mostUsedButton = await this.getMostUsedButton();

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        new: newUsers,
      },
      buttons: {
        total: totalButtons,
        average_per_user: parseFloat(averageButtonsPerUser.toFixed(2)),
      },
      timeLogs: {
        total: totalTimeLogs,
        last_30_days: timeLogsLast30Days,
        total_hours_tracked: parseFloat(totalHours.toFixed(2)),
        total_hours_last_30_days: parseFloat(totalHoursLast30Days.toFixed(2)),
      },
      activity: {
        most_active_user: mostActiveUser,
        most_used_button: mostUsedButton,
      },
    };
  }

  /**
   * Calculate total hours tracked from time logs
   */
  private async calculateTotalHours(since?: Date): Promise<number> {
    const queryBuilder = this.timeLogRepository
      .createQueryBuilder('tl')
      .where('tl.deleted_at IS NULL');

    if (since) {
      queryBuilder.andWhere('tl.timestamp > :since', { since });
    }

    const timeLogs = await queryBuilder
      .orderBy('tl.user_id', 'ASC')
      .addOrderBy('tl.button_id', 'ASC')
      .addOrderBy('tl.timestamp', 'ASC')
      .getMany();

    let totalMinutes = 0;
    let lastStart: { userId: string; buttonId: string; timestamp: Date } | null = null;

    for (const log of timeLogs) {
      if (log.type === 'start') {
        lastStart = {
          userId: log.user_id,
          buttonId: log.button_id,
          timestamp: log.timestamp,
        };
      } else if (log.type === 'stop' && lastStart) {
        // Only count if it's for the same user and button
        if (lastStart.userId === log.user_id && lastStart.buttonId === log.button_id) {
          const duration = log.timestamp.getTime() - lastStart.timestamp.getTime();
          totalMinutes += duration / (1000 * 60);
          lastStart = null;
        }
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
        },
        order: { timestamp: 'ASC' },
      });

      let userMinutes = 0;
      let lastStart: { buttonId: string; timestamp: Date } | null = null;

      for (const log of timeLogs) {
        if (log.type === 'start') {
          lastStart = { buttonId: log.button_id, timestamp: log.timestamp };
        } else if (log.type === 'stop' && lastStart && lastStart.buttonId === log.button_id) {
          const duration = log.timestamp.getTime() - lastStart.timestamp.getTime();
          userMinutes += duration / (1000 * 60);
          lastStart = null;
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
   * Get the most used button (by number of time log pairs)
   */
  private async getMostUsedButton(): Promise<{
    name: string;
    emoji?: string;
    usage_count: number;
  } | null> {
    const result = await this.timeLogRepository
      .createQueryBuilder('tl')
      .select('tl.button_id', 'button_id')
      .addSelect('COUNT(*)', 'usage_count')
      .where('tl.deleted_at IS NULL')
      .andWhere("tl.type = 'start'")
      .groupBy('tl.button_id')
      .orderBy('usage_count', 'DESC')
      .limit(1)
      .getRawOne();

    if (!result) {
      return null;
    }

    const button = await this.buttonRepository.findOne({
      where: { id: result.button_id },
    });

    if (!button) {
      return null;
    }

    return {
      name: button.name,
      emoji: button.emoji,
      usage_count: parseInt(result.usage_count),
    };
  }
}
