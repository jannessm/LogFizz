import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { Button } from '../entities/Button.js';
import { TimeLog } from '../entities/TimeLog.js';
import { LessThan, Not, IsNull } from 'typeorm';

export class CleanupService {
  private userRepository = AppDataSource.getRepository(User);
  private buttonRepository = AppDataSource.getRepository(Button);
  private timeLogRepository = AppDataSource.getRepository(TimeLog);

  /**
   * Permanently delete records that were soft-deleted more than 4 months ago
   */
  async cleanupOldDeletedRecords(): Promise<{
    usersDeleted: number;
    buttonsDeleted: number;
    timeLogsDeleted: number;
  }> {
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

    // Delete TimeLogs first (has foreign keys to Button and User)
    const timeLogsResult = await this.timeLogRepository.delete({
      deleted_at: LessThan(fourMonthsAgo),
    });

    // Delete Buttons (has foreign key to User)
    const buttonsResult = await this.buttonRepository.delete({
      deleted_at: LessThan(fourMonthsAgo),
    });

    // Delete Users last
    const usersResult = await this.userRepository.delete({
      deleted_at: LessThan(fourMonthsAgo),
    });

    return {
      usersDeleted: usersResult.affected || 0,
      buttonsDeleted: buttonsResult.affected || 0,
      timeLogsDeleted: timeLogsResult.affected || 0,
    };
  }

  /**
   * Get count of records pending permanent deletion
   */
  async getPendingDeletionCount(): Promise<{
    users: number;
    buttons: number;
    timeLogs: number;
  }> {
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

    const users = await this.userRepository.count({
      where: {
        deleted_at: LessThan(fourMonthsAgo),
      },
    });

    const buttons = await this.buttonRepository.count({
      where: {
        deleted_at: LessThan(fourMonthsAgo),
      },
    });

    const timeLogs = await this.timeLogRepository.count({
      where: {
        deleted_at: LessThan(fourMonthsAgo),
      },
    });

    return { users, buttons, timeLogs };
  }
}
