#!/usr/bin/env tsx
/**
 * User Balance Email CLI
 * 
 * Sends personalized balance statistics emails to users who have opted in.
 * Recalculates all balances before sending (like the frontend does on page load).
 * 
 * Usage:
 *   npm run balance-email:weekly         # Send to users with weekly frequency
 *   npm run balance-email:monthly        # Send to users with monthly frequency
 *   npm run balance-email:test -- <email> [userId]
 *                                        # Send a test email to <email>, optionally
 *                                        #   using real balance data for [userId]
 */

import 'reflect-metadata';
import { AppDataSource } from '../config/database.js';
import { UserSettingsService } from '../services/user-settings.service.js';
import { UserBalanceService } from '../services/user-balance.service.js';
import { EmailService } from '../services/email.service.js';
import { User } from '../entities/User.js';
import type { StatisticsEmailFrequency } from '../../../lib/types/index.js';

async function main() {
  const args = process.argv.slice(2);

  // ── Test mode ──────────────────────────────────────────────────────────────
  // Usage: tsx send-user-balance-emails.ts --test <email> [userId]
  if (args.includes('--test')) {
    const testIdx = args.indexOf('--test');
    const testEmail = args[testIdx + 1];
    if (!testEmail || testEmail.startsWith('--')) {
      console.error('Usage: npm run balance-email:test -- <email> [userId]');
      process.exit(1);
    }
    const testUserId = args[testIdx + 2] && !args[testIdx + 2].startsWith('--')
      ? args[testIdx + 2]
      : undefined;

    console.log(`\n[TEST MODE] Sending balance email to ${testEmail}\n`);

    await AppDataSource.initialize();
    console.log('✓ Database connected\n');

    const emailService = new EmailService();
    const userBalanceService = new UserBalanceService();

    let summaries: Awaited<ReturnType<UserBalanceService['recalculateAndSummarize']>> = [];
    let displayName = 'Test User';
    let locale = 'en-US';

    if (testUserId) {
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id: testUserId } });
      if (!user) {
        console.error(`✗ User ${testUserId} not found`);
        await AppDataSource.destroy();
        process.exit(1);
      }
      displayName = user.name ?? user.email;
      console.log(`  → Recalculating balances for user ${user.email}...`);
      summaries = await userBalanceService.recalculateAndSummarize(testUserId);
      console.log(`    Found ${summaries.length} target(s) with balance data`);
    } else {
      console.log('  (No userId provided – sending email with empty balance data)');
    }

    console.log(`  → Sending test email to ${testEmail}...`);
    await emailService.sendUserBalanceEmail(testEmail, displayName, summaries, locale);
    console.log(`\n  ✓ Test email sent to ${testEmail}`);

    await AppDataSource.destroy();
    console.log('✓ Database connection closed');
    return;
  }

  // ── Regular (scheduled) mode ───────────────────────────────────────────────
  // Determine frequency from command line
  let frequency: StatisticsEmailFrequency = 'weekly';
  if (args.includes('--monthly')) {
    frequency = 'monthly';
  } else if (args.includes('--weekly')) {
    frequency = 'weekly';
  }

  try {
    // Initialize database
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    console.log('✓ Database connected\n');

    const userSettingsService = new UserSettingsService();
    const userBalanceService = new UserBalanceService();
    const emailService = new EmailService();
    const userRepository = AppDataSource.getRepository(User);

    // Find all users with the specified frequency
    const settingsList = await userSettingsService.getSettingsByFrequency(frequency);
    console.log(`Found ${settingsList.length} user(s) with ${frequency} email frequency\n`);

    let sent = 0;
    let failed = 0;

    for (const settings of settingsList) {
      const user = await userRepository.findOne({
        where: { id: settings.user_id },
      });

      if (!user || user.deleted_at) {
        console.log(`  ⊘ Skipping deleted/missing user ${settings.user_id}`);
        continue;
      }

      if (!user.email_verified_at) {
        console.log(`  ⊘ Skipping unverified user ${user.email}`);
        continue;
      }

      try {
        console.log(`  → Recalculating balances for ${user.email}...`);
        const summaries = await userBalanceService.recalculateAndSummarize(user.id);
        
        console.log(`    Found ${summaries.length} target(s) with balance data`);
        
        console.log(`  → Sending balance email to ${user.email} (locale: ${settings.locale})...`);
        await emailService.sendUserBalanceEmail(
          user.email,
          user.name,
          summaries,
          settings.locale,
        );

        console.log(`  ✓ Email sent to ${user.email}`);
        sent++;
      } catch (error) {
        console.error(`  ✗ Failed for ${user.email}:`, error instanceof Error ? error.message : error);
        failed++;
      }
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`  Balance Email Summary (${frequency})`);
    console.log(`═══════════════════════════════════════`);
    console.log(`  Sent:   ${sent}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total:  ${settingsList.length}`);
    console.log(`═══════════════════════════════════════\n`);

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
