#!/usr/bin/env tsx
/**
 * Statistics Email CLI
 * 
 * Generates system-wide statistics and sends them to the admin email.
 * 
 * Usage:
 *   npm run statistics:send
 *   npm run statistics:send -- --email admin@example.com
 *   npm run statistics:show
 */

import 'reflect-metadata';
import { AppDataSource } from '../config/database.js';
import { StatisticsService } from '../services/statistics.service.js';
import { EmailService } from '../services/email.service.js';

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const getArg = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index !== -1 && args[index + 1] ? args[index + 1] : undefined;
  };

  const hasFlag = (flag: string): boolean => args.includes(flag);

  try {
    // Initialize database
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    console.log('✓ Database connected\n');

    const statisticsService = new StatisticsService();

    // Generate statistics
    console.log('Generating system statistics...');
    const statistics = await statisticsService.generateSystemStatistics();
    console.log('✓ Statistics generated\n');

    // Show statistics in console
    if (hasFlag('--show')) {
      console.log('═══════════════════════════════════════');
      console.log('  TAPSHIFT SYSTEM STATISTICS REPORT');
      console.log('═══════════════════════════════════════\n');

      console.log('👥 USER STATISTICS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Total Users: ${statistics.users.total}`);
      console.log(`Active Users (Last 30 Days): ${statistics.users.active}`);
      console.log(`New Users (Last 30 Days): ${statistics.users.new}\n`);

      console.log('🎯 BUTTON STATISTICS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Total Buttons: ${statistics.buttons.total}`);
      console.log(`Average per User: ${statistics.buttons.average_per_user}\n`);

      console.log('⏱️  TIME TRACKING STATISTICS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Total Time Logs: ${statistics.timeLogs.total.toLocaleString()}`);
      console.log(`Time Logs (Last 30 Days): ${statistics.timeLogs.last_30_days.toLocaleString()}`);
      console.log(`Total Hours Tracked: ${statistics.timeLogs.total_hours_tracked.toLocaleString()} hours`);
      console.log(`Hours Tracked (Last 30 Days): ${statistics.timeLogs.total_hours_last_30_days.toLocaleString()} hours\n`);

      console.log('🏆 TOP ACTIVITY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      if (statistics.activity.most_active_user) {
        console.log(`Most Active User: ${statistics.activity.most_active_user.name}`);
        console.log(`  Email: ${statistics.activity.most_active_user.email}`);
        console.log(`  Hours Tracked: ${statistics.activity.most_active_user.hours_tracked.toLocaleString()} hours`);
      } else {
        console.log('Most Active User: No active users found');
      }
      console.log('');

      if (statistics.activity.most_used_button) {
        const emoji = statistics.activity.most_used_button.emoji || '';
        console.log(`Most Used Button: ${emoji} ${statistics.activity.most_used_button.name}`);
        console.log(`  Times Used: ${statistics.activity.most_used_button.usage_count.toLocaleString()}`);
      } else {
        console.log('Most Used Button: No button activity found');
      }

      console.log('\n═══════════════════════════════════════\n');
    }

    // Send email if requested
    if (!hasFlag('--show') || hasFlag('--email')) {
      // Get admin email from environment or command line
      const adminEmail = getArg('--email') || process.env.ADMIN_EMAIL;

      if (!adminEmail) {
        console.error('✗ Error: No admin email specified.');
        console.error('  Please set ADMIN_EMAIL environment variable or use --email flag');
        console.error('  Example: npm run statistics:send -- --email admin@example.com');
        process.exit(1);
      }

      console.log(`Sending statistics email to: ${adminEmail}`);

      const emailService = new EmailService();
      await emailService.sendStatisticsEmail(adminEmail, statistics);

      console.log('✓ Statistics email sent successfully!\n');
    }

    // Close database connection
    await AppDataSource.destroy();
    console.log('✓ Database connection closed');

  } catch (error) {
    console.error('\n✗ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main();
