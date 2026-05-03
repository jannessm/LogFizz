#!/usr/bin/env tsx
/**
 * Daily Mail Runner
 *
 * Single entry point for all scheduled emails – designed to be triggered once
 * per day via crontab inside the Docker container.
 *
 * What it does each run:
 *  1. Balance emails – weekly  (sent every day; the service filters by user preference)
 *  2. Balance emails – monthly (sent only on the 1st of each month)
 *  3. Statistics email          (sent to ADMIN_EMAIL every day)
 *
 * Usage:
 *   npm run mail:daily
 */

import '../env.js';
import 'reflect-metadata';
import { AppDataSource } from '../config/database.js';
import { UserSettingsService } from '../services/user-settings.service.js';
import { UserBalanceService } from '../services/user-balance.service.js';
import { EmailService } from '../services/email.service.js';
import { StatisticsService } from '../services/statistics.service.js';
import { User } from '../entities/User.js';
import type { StatisticsEmailFrequency } from '../../../lib/types/index.js';

async function sendBalanceEmails(
  frequency: StatisticsEmailFrequency,
  userSettingsService: UserSettingsService,
  userBalanceService: UserBalanceService,
  emailService: EmailService,
  userRepository: ReturnType<typeof AppDataSource.getRepository<User>>,
): Promise<void> {
  console.log(`\n── Balance emails (${frequency}) ────────────────────────`);

  const settingsList = await userSettingsService.getSettingsByFrequency(frequency);
  console.log(`Found ${settingsList.length} user(s) with ${frequency} email frequency`);

  let sent = 0;
  let failed = 0;

  for (const settings of settingsList) {
    const user = await userRepository.findOne({ where: { id: settings.user_id } });

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

  console.log(`  Result: ${sent} sent, ${failed} failed`);
}

async function sendStatisticsEmail(emailService: EmailService): Promise<void> {
  console.log('\n── Statistics email ─────────────────────────────────');

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn('  ⊘ ADMIN_EMAIL not set – skipping statistics email');
    return;
  }

  const statisticsService = new StatisticsService();
  console.log('  → Generating system statistics...');
  const statistics = await statisticsService.generateSystemStatistics();

  console.log(`  → Sending statistics email to ${adminEmail}...`);
  await emailService.sendStatisticsEmail(adminEmail, statistics);
  console.log(`  ✓ Statistics email sent to ${adminEmail}`);
}

async function main() {
  const today = new Date();
  const isFirstOfMonth = today.getDate() === 1;

  console.log('═══════════════════════════════════════');
  console.log('  TapShift Daily Mail Runner');
  console.log(`  ${today.toISOString()}`);
  console.log('═══════════════════════════════════════');

  console.log('\nConnecting to database...');
  await AppDataSource.initialize();
  console.log('✓ Database connected');

  const userSettingsService = new UserSettingsService();
  const userBalanceService = new UserBalanceService();
  const emailService = new EmailService();
  const userRepository = AppDataSource.getRepository(User);

  try {
    await sendBalanceEmails('weekly', userSettingsService, userBalanceService, emailService, userRepository);

    if (isFirstOfMonth) {
      await sendBalanceEmails('monthly', userSettingsService, userBalanceService, emailService, userRepository);
    } else {
      console.log('\n── Balance emails (monthly) ─────────────────────────');
      console.log('  ⊘ Skipped – not the 1st of the month');
    }

    await sendStatisticsEmail(emailService);
  } finally {
    await AppDataSource.destroy();
    console.log('\n✓ Database connection closed');
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  Daily mail run complete');
  console.log('═══════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('\n✗ Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
