import 'reflect-metadata';
import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { Button } from '../entities/Button.js';
import { DailyTarget } from '../entities/DailyTarget.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Holiday } from '../entities/Holiday.js';
import { hashPassword } from '../utils/password.js';
import { hashPasswordForTransport } from '../../../lib/utils/passwordHash.node.js';

/**
 * Seed script for development environment
 * Creates sample users, buttons, time logs, and holidays
 * 
 * Usage: npm run seed
 */

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ Database connection established');
    }

    // Clear existing data (only in development!)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🧹 Clearing existing data...');
      // Use raw SQL to truncate with CASCADE to handle foreign key constraints
      await AppDataSource.query('TRUNCATE TABLE time_logs, buttons, daily_targets, holidays, users RESTART IDENTITY CASCADE');
      console.log('✅ Existing data cleared');
    }

    // Create sample users
    console.log('👤 Creating sample users...');
    const userRepo = AppDataSource.getRepository(User);
    
    // Hash passwords as if they came from the client (SHA-256 with email)
    // Then bcrypt hash them for storage
    const demoEmail = 'demo@example.com';
    const demoPassword = 'demo123';
    const demoHashedForTransport = hashPasswordForTransport(demoPassword, demoEmail);
    
    const demoUser = userRepo.create({
      email: demoEmail,
      password_hash: await hashPassword(demoHashedForTransport),
      name: 'Demo User',
    });
    await userRepo.save(demoUser);
    
    const testEmail = 'test@example.com';
    const testPassword = 'test123';
    const testHashedForTransport = hashPasswordForTransport(testPassword, testEmail);
    
    const testUser = userRepo.create({
      email: testEmail,
      password_hash: await hashPassword(testHashedForTransport),
      name: 'Test User',
    });
    await userRepo.save(testUser);
    
    console.log('✅ Created 2 sample users');
    console.log('   - demo@example.com (password: demo123)');
    console.log('   - test@example.com (password: test123)');

    // Create sample daily targets for demo user (before buttons so we can link them)
    console.log('🎯 Creating sample daily targets...');
    const targetRepo = AppDataSource.getRepository(DailyTarget);
    
    // Create work target starting from October 2025 (to test cumulative balance)
    const workStartingFrom = new Date(Date.UTC(2025, 9, 1)); // October 1, 2025
    const workTarget = targetRepo.create({
      user_id: demoUser.id,
      name: 'Work Target',
      duration_minutes: [480, 480, 480, 480, 480], // 8 hours per day
      weekdays: [1, 2, 3, 4, 5], // Monday to Friday
      starting_from: workStartingFrom,
    });
    await targetRepo.save(workTarget);

    // Create study target starting from November 2025
    const studyStartingFrom = new Date(Date.UTC(2025, 10, 1)); // November 1, 2025
    const studyTarget = targetRepo.create({
      user_id: demoUser.id,
      name: 'Study Target',
      duration_minutes: [120, 120], // 2 hours per day
      weekdays: [2, 4], // Tuesday and Thursday
      starting_from: studyStartingFrom,
    });
    await targetRepo.save(studyTarget);

    // Create exercise target with ending_at date (to test targets that end)
    const exerciseStartingFrom = new Date(Date.UTC(2025, 8, 1)); // September 1, 2025
    const exerciseEndingAt = new Date(Date.UTC(2025, 9, 31)); // October 31, 2025
    const exerciseTarget = targetRepo.create({
      user_id: demoUser.id,
      name: 'Exercise Target (Ended)',
      duration_minutes: [60, 60, 60], // 1 hour per day
      weekdays: [1, 3, 5], // Monday, Wednesday, Friday
      starting_from: exerciseStartingFrom,
      ending_at: exerciseEndingAt,
    });
    await targetRepo.save(exerciseTarget);

    console.log('✅ Created 3 sample daily targets');
    console.log('   - Work Target: starting from Oct 2025, Mon-Fri 8h');
    console.log('   - Study Target: starting from Nov 2025, Tue/Thu 2h');
    console.log('   - Exercise Target (Ended): Sep-Oct 2025, Mon/Wed/Fri 1h');

    // Create sample buttons for demo user
    console.log('🔘 Creating sample buttons...');
    const buttonRepo = AppDataSource.getRepository(Button);
    
    const workButton = buttonRepo.create({
      user_id: demoUser.id,
      name: 'Work',
      emoji: '💼',
      color: '#3B82F6',
      target_id: workTarget.id,
      auto_subtract_breaks: true,
      archived: false,
    });
    await buttonRepo.save(workButton);

    const studyButton = buttonRepo.create({
      user_id: demoUser.id,
      name: 'Study',
      emoji: '📚',
      color: '#10B981',
      target_id: studyTarget.id,
      auto_subtract_breaks: false,
      archived: false,
    });
    await buttonRepo.save(studyButton);

    const exerciseButton = buttonRepo.create({
      user_id: demoUser.id,
      name: 'Exercise',
      emoji: '🏃',
      color: '#EF4444',
      auto_subtract_breaks: false,
      archived: false,
    });
    await buttonRepo.save(exerciseButton);

    const projectButton = buttonRepo.create({
      user_id: demoUser.id,
      name: 'Side Project',
      emoji: '🚀',
      color: '#8B5CF6',
      auto_subtract_breaks: false,
      archived: false,
    });
    await buttonRepo.save(projectButton);

    // Create buttons for test user
    const meetingButton = buttonRepo.create({
      user_id: testUser.id,
      name: 'Meetings',
      emoji: '📞',
      color: '#F59E0B',
      auto_subtract_breaks: false,
      archived: false,
    });
    await buttonRepo.save(meetingButton);

    // Create button linked to the ended exercise target (to test ended target behavior)
    const exerciseButtonOld = buttonRepo.create({
      user_id: demoUser.id,
      name: 'Old Exercise',
      emoji: '🏋️',
      color: '#EC4899',
      target_id: exerciseTarget.id,
      auto_subtract_breaks: false,
      archived: true, // Mark as archived for testing
    });
    await buttonRepo.save(exerciseButtonOld);

    console.log('✅ Created 6 sample buttons (3 linked to daily targets)');

    // Create sample time logs for demo user
    // Now using the new structure with start_timestamp, end_timestamp, and duration_minutes
    console.log('⏱️  Creating sample time logs...');
    const timeLogRepo = AppDataSource.getRepository(TimeLog);

    // Create historical time logs for September 2025 (for the exercise target)
    console.log('   - Creating September 2025 exercise logs...');
    for (let day = 1; day <= 30; day++) {
      const date = new Date(Date.UTC(2025, 8, day)); // September 2025
      const dayOfWeek = date.getUTCDay();
      
      // Exercise on Mon, Wed, Fri (matching the target)
      if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
        const exerciseStart = new Date(Date.UTC(2025, 8, day, 7, 0, 0));
        const exerciseEnd = new Date(Date.UTC(2025, 8, day, 8, 0, 0)); // 1 hour

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: exerciseButtonOld.id,
          start_timestamp: exerciseStart,
          end_timestamp: exerciseEnd,
          timezone: 'Europe/Berlin',
          notes: 'Morning exercise',
          apply_break_calculation: exerciseButtonOld.auto_subtract_breaks,
        }));
      }
    }

    // Create historical time logs for October 2025 (to test cumulative balance)
    console.log('   - Creating October 2025 work and exercise logs...');
    for (let day = 1; day <= 31; day++) {
      const date = new Date(Date.UTC(2025, 9, day)); // October 2025
      const dayOfWeek = date.getUTCDay();
      
      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Work session: 9:00 AM - 5:00 PM (8 hours exactly to match target)
        const workStart = new Date(Date.UTC(2025, 9, day, 9, 0, 0));
        const workEnd = new Date(Date.UTC(2025, 9, day, 17, 0, 0));

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: workButton.id,
          start_timestamp: workStart,
          end_timestamp: workEnd,
          timezone: 'Europe/Berlin',
          notes: 'October work session',
          apply_break_calculation: workButton.auto_subtract_breaks,
        }));
      }

      // Exercise on Mon, Wed, Fri (matching the target, ends Oct 31)
      if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
        const exerciseStart = new Date(Date.UTC(2025, 9, day, 7, 0, 0));
        const exerciseEnd = new Date(Date.UTC(2025, 9, day, 8, 0, 0)); // 1 hour

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: exerciseButtonOld.id,
          start_timestamp: exerciseStart,
          end_timestamp: exerciseEnd,
          timezone: 'Europe/Berlin',
          notes: 'Morning exercise (last month)',
          apply_break_calculation: exerciseButtonOld.auto_subtract_breaks,
        }));
      }
    }

    // Create time logs for November 2025 with some overtime (to test positive balance)
    console.log('   - Creating November 2025 work/study logs...');
    for (let day = 1; day <= 23; day++) { // Up to Nov 23
      const date = new Date(Date.UTC(2025, 10, day)); // November 2025
      const dayOfWeek = date.getUTCDay();
      
      // Skip weekends for work
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Work session: 9:00 AM - 5:30 PM (8.5 hours - 30 min overtime)
        const workStart = new Date(Date.UTC(2025, 10, day, 9, 0, 0));
        const workEnd = new Date(Date.UTC(2025, 10, day, 17, 30, 0));

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: workButton.id,
          start_timestamp: workStart,
          end_timestamp: workEnd,
          timezone: 'Europe/Berlin',
          notes: 'November work session',
          apply_break_calculation: workButton.auto_subtract_breaks,
        }));

        // Study sessions on Tue & Thu
        if (dayOfWeek === 2 || dayOfWeek === 4) {
          const studyStart = new Date(Date.UTC(2025, 10, day, 19, 0, 0));
          const studyEnd = new Date(Date.UTC(2025, 10, day, 21, 0, 0)); // 2 hours

          await timeLogRepo.save(timeLogRepo.create({
            user_id: demoUser.id,
            button_id: studyButton.id,
            start_timestamp: studyStart,
            end_timestamp: studyEnd,
            timezone: 'Europe/Berlin',
            notes: 'November study session',
            apply_break_calculation: studyButton.auto_subtract_breaks,
          }));
        }
      }
    }
    
    // Create time logs for the past week (current)
    console.log('   - Creating current week time logs...');
    const now = new Date();
    const daysToGenerate = 7;

    for (let daysAgo = daysToGenerate; daysAgo >= 0; daysAgo--) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      date.setHours(0, 0, 0, 0);

      const dayOfWeek = date.getDay();
      
      // Skip weekends for work
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Work session: 9:00 AM - 5:30 PM
        const workStart = new Date(date);
        workStart.setHours(9, 0, 0, 0);
        const workEnd = new Date(date);
        workEnd.setHours(17, 30, 0, 0);

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: workButton.id,
          start_timestamp: workStart,
          end_timestamp: workEnd,
          timezone: 'Europe/Berlin',
          notes: 'Work day',
          apply_break_calculation: workButton.auto_subtract_breaks,
        }));

        // Study session: 7:00 PM - 9:00 PM
        if (daysAgo > 2) { // Only for older days
          const studyStart = new Date(date);
          studyStart.setHours(19, 0, 0, 0);
          const studyEnd = new Date(date);
          studyEnd.setHours(21, 0, 0, 0);

          await timeLogRepo.save(timeLogRepo.create({
            user_id: demoUser.id,
            button_id: studyButton.id,
            start_timestamp: studyStart,
            end_timestamp: studyEnd,
            timezone: 'Europe/Berlin',
            notes: 'Evening study session',
            apply_break_calculation: studyButton.auto_subtract_breaks,
          }));
        }
      }

      // Exercise on Mon, Wed, Fri
      if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
        const exerciseStart = new Date(date);
        exerciseStart.setHours(6, 30, 0, 0);
        const exerciseEnd = new Date(date);
        exerciseEnd.setHours(7, 30, 0, 0);

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: exerciseButton.id,
          start_timestamp: exerciseStart,
          end_timestamp: exerciseEnd,
          timezone: 'Europe/Berlin',
          notes: 'Morning workout',
          apply_break_calculation: exerciseButton.auto_subtract_breaks,
        }));
      }

      // Side project on weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const projectStart = new Date(date);
        projectStart.setHours(10, 0, 0, 0);
        const projectEnd = new Date(date);
        projectEnd.setHours(13, 30, 0, 0);

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: projectButton.id,
          start_timestamp: projectStart,
          end_timestamp: projectEnd,
          timezone: 'Europe/Berlin',
          notes: 'Weekend coding session',
          apply_break_calculation: projectButton.auto_subtract_breaks,
        }));
      }
    }

    // Add an active timer for today (only start, no end)
    const activeStart = new Date();
    activeStart.setHours(activeStart.getHours() - 2, 0, 0, 0);
    
    await timeLogRepo.save(timeLogRepo.create({
      user_id: demoUser.id,
      button_id: workButton.id,
      start_timestamp: activeStart,
      // No end_timestamp - this is an active timer
      timezone: 'Europe/Berlin',
      notes: 'Currently working',
      apply_break_calculation: workButton.auto_subtract_breaks,
    }));

    console.log('✅ Created sample time logs');
    console.log('   - September 2025: Exercise sessions (1h Mon/Wed/Fri)');
    console.log('   - October 2025: Full work days (8h each weekday) + Exercise (ended Oct 31)');
    console.log('   - November 2025: Work + overtime (8.5h/day) and study sessions');
    console.log('   - Current week: Regular time logs');
    console.log('   - Including an active timer for demo user');

    

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - 2 users created (demo@example.com, test@example.com)');
    console.log('   - 3 daily targets created:');
    console.log('     * Work: Mon-Fri 8h, starting Oct 2025');
    console.log('     * Study: Tue/Thu 2h, starting Nov 2025');
    console.log('     * Exercise (Ended): Mon/Wed/Fri 1h, Sep-Oct 2025 (with ending_at date)');
    console.log('   - 6 buttons created (3 linked to targets)');
    console.log('   - Historical time logs for Sep-Nov 2025 (for testing cumulative balance & ended targets)');
    console.log('   - Current week time logs');
    console.log('   - 1 active timer');
    console.log('\n💡 You can now login with:');
    console.log('   Email: demo@example.com');
    console.log('   Password: demo123');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    // Close database connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('\n✅ Database connection closed');
    }
  }
}

// Run the seed script
seed().catch((error) => {
  console.error('Failed to seed database:', error);
  process.exit(1);
});
