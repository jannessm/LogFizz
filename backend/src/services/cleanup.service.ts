import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { Timer } from '../entities/Timer.js';
import { TimeLog } from '../entities/TimeLog.js';
import { LessThan, Not, IsNull } from 'typeorm';
import { HolidayCrawlerService } from './holiday-crawler.service.js';

export class CleanupService {
  private userRepository = AppDataSource.getRepository(User);
  private timerRepository = AppDataSource.getRepository(Timer);
  private timeLogRepository = AppDataSource.getRepository(TimeLog);
  private holidayCrawler = new HolidayCrawlerService();

  /**
   * Permanently delete records that were soft-deleted more than 4 months ago
   */
  async cleanupOldDeletedRecords(): Promise<{
    usersDeleted: number;
    timersDeleted: number;
    timeLogsDeleted: number;
  }> {
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

    // Delete TimeLogs first (has foreign keys to Timer and User)
    const timeLogsResult = await this.timeLogRepository.delete({
      deleted_at: LessThan(fourMonthsAgo),
    });

    // Delete Timers (has foreign key to User)
    const timersResult = await this.timerRepository.delete({
      deleted_at: LessThan(fourMonthsAgo),
    });

    // Delete Users last
    const usersResult = await this.userRepository.delete({
      deleted_at: LessThan(fourMonthsAgo),
    });

    return {
      usersDeleted: usersResult.affected || 0,
      timersDeleted: timersResult.affected || 0,
      timeLogsDeleted: timeLogsResult.affected || 0,
    };
  }

  /**
   * Get count of records pending permanent deletion
   */
  async getPendingDeletionCount(): Promise<{
    users: number;
    timers: number;
    timeLogs: number;
  }> {
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

    const users = await this.userRepository.count({
      where: {
        deleted_at: LessThan(fourMonthsAgo),
      },
    });

    const timers = await this.timerRepository.count({
      where: {
        deleted_at: LessThan(fourMonthsAgo),
      },
    });

    const timeLogs = await this.timeLogRepository.count({
      where: {
        deleted_at: LessThan(fourMonthsAgo),
      },
    });

    return { users, timers, timeLogs };
  }

  /**
   * Refresh outdated holiday data
   * Should be run periodically (e.g., weekly or monthly)
   */
  async refreshHolidays(): Promise<void> {
    console.log('=== Holiday Data Refresh Job Started ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);

    try {
      const result = await this.holidayCrawler.refreshOutdatedHolidays();
      
      console.log('\n=== Refresh Summary ===');
      console.log(`Refreshed: ${result.refreshed}`);
      console.log(`Failed: ${result.failed}`);
      
      if (result.details.length > 0) {
        console.log('\n=== Refresh Details ===');
        result.details.forEach(detail => {
          const status = detail.success ? '✓' : '✗';
          console.log(`${status} ${detail.country} ${detail.year}: ${detail.message}`);
        });
      }
    } catch (error) {
      console.error('Error during holiday refresh:', error);
      throw error;
    }

    console.log('\n=== Holiday Data Refresh Job Completed ===');
  }

  /**
   * Check and ensure current year holidays are available
   */
  async ensureCurrentYearHolidays(countries: string[]): Promise<void> {
    const currentYear = new Date().getFullYear();
    
    console.log(`Ensuring holidays for ${countries.length} countries for year ${currentYear}...`);

    for (const country of countries) {
      try {
        const needsRefresh = await this.holidayCrawler.needsRefresh(country, currentYear);
        
        if (needsRefresh) {
          console.log(`Fetching holidays for ${country} ${currentYear}...`);
          await this.holidayCrawler.crawlHolidays(country, currentYear);
        } else {
          console.log(`✓ ${country} ${currentYear} is up to date`);
        }
      } catch (error) {
        console.error(`Error ensuring holidays for ${country}:`, error);
      }
    }
  }

  /**
   * Run all cleanup and maintenance tasks
   */
  async runAllMaintenanceTasks(): Promise<void> {
    console.log('\n=== Starting Maintenance Tasks ===\n');

    // 1. Refresh holiday data
    console.log('Task 1: Refreshing holiday data...');
    await this.refreshHolidays();

    // 2. Clean up old deleted records
    console.log('\nTask 2: Cleaning up old deleted records...');
    const deletionCount = await this.getPendingDeletionCount();
    console.log(`Records pending deletion: ${deletionCount.users} users, ${deletionCount.timers} timers, ${deletionCount.timeLogs} time logs`);
    
    if (deletionCount.users > 0 || deletionCount.timers > 0 || deletionCount.timeLogs > 0) {
      const result = await this.cleanupOldDeletedRecords();
      console.log(`✓ Permanently deleted: ${result.usersDeleted} users, ${result.timersDeleted} timers, ${result.timeLogsDeleted} time logs`);
    } else {
      console.log('✓ No old deleted records to clean up');
    }

    console.log('\n=== Maintenance Tasks Completed ===\n');
  }
}
