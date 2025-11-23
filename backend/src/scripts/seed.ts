import 'reflect-metadata';
import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { Button } from '../entities/Button.js';
import { DailyTarget } from '../entities/DailyTarget.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Holiday } from '../entities/Holiday.js';
import { hashPassword } from '../utils/password.js';
import crypto from 'crypto';

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
    
    // Hash passwords as the frontend would send them (SHA-256 of password + email, then bcrypt)
    const demoEmail = 'demo@example.com';
    const demoPassword = 'demo123';
    const demoClientHash = crypto.createHash('sha256').update(demoPassword + demoEmail).digest('hex');
    
    const demoUser = userRepo.create({
      email: demoEmail,
      password_hash: await hashPassword(demoClientHash),
      name: 'Demo User',
    });
    await userRepo.save(demoUser);
    
    const testEmail = 'test@example.com';
    const testPassword = 'test123';
    const testClientHash = crypto.createHash('sha256').update(testPassword + testEmail).digest('hex');
    
    const testUser = userRepo.create({
      email: testEmail,
      password_hash: await hashPassword(testClientHash),
      name: 'Test User',
    });
    await userRepo.save(testUser);
    
    console.log('✅ Created 2 sample users');
    console.log('   - demo@example.com (password: demo123)');
    console.log('   - test@example.com (password: test123)');

    // Create sample daily targets for demo user (before buttons so we can link them)
    console.log('🎯 Creating sample daily targets...');
    const targetRepo = AppDataSource.getRepository(DailyTarget);
    
    const workTarget = targetRepo.create({
      user_id: demoUser.id,
      name: 'Work Target',
      duration_minutes: [480, 480, 480, 480, 480, 0, 0], // 8 hours Mon-Fri
      weekdays: [1, 2, 3, 4, 5], // Monday to Friday
    });
    await targetRepo.save(workTarget);

    const studyTarget = targetRepo.create({
      user_id: demoUser.id,
      name: 'Study Target',
      duration_minutes: [0, 120, 0, 120, 0, 0, 0], // 2 hours Tue & Thu
      weekdays: [2, 4], // Tuesday and Thursday
    });
    await targetRepo.save(studyTarget);

    console.log('✅ Created 2 sample daily targets');

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
    });
    await buttonRepo.save(workButton);

    const studyButton = buttonRepo.create({
      user_id: demoUser.id,
      name: 'Study',
      emoji: '📚',
      color: '#10B981',
      target_id: studyTarget.id,
      auto_subtract_breaks: false,
    });
    await buttonRepo.save(studyButton);

    const exerciseButton = buttonRepo.create({
      user_id: demoUser.id,
      name: 'Exercise',
      emoji: '🏃',
      color: '#EF4444',
      auto_subtract_breaks: false,
    });
    await buttonRepo.save(exerciseButton);

    const projectButton = buttonRepo.create({
      user_id: demoUser.id,
      name: 'Side Project',
      emoji: '🚀',
      color: '#8B5CF6',
      auto_subtract_breaks: false,
    });
    await buttonRepo.save(projectButton);

    // Create buttons for test user
    const meetingButton = buttonRepo.create({
      user_id: testUser.id,
      name: 'Meetings',
      emoji: '📞',
      color: '#F59E0B',
      auto_subtract_breaks: false,
    });
    await buttonRepo.save(meetingButton);

    console.log('✅ Created 5 sample buttons (2 linked to daily targets)');

    // Create sample time logs for demo user
    console.log('⏱️  Creating sample time logs...');
    const timeLogRepo = AppDataSource.getRepository(TimeLog);
    
    // Create time logs for the past week
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
        const workStop = new Date(date);
        workStop.setHours(17, 30, 0, 0);

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: workButton.id,
          type: 'start',
          timestamp: workStart,
          timezone: 'Europe/Berlin',
          description: 'Starting work day',
        }));

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: workButton.id,
          type: 'stop',
          timestamp: workStop,
          timezone: 'Europe/Berlin',
          description: 'End of work day',
        }));

        // Study session: 7:00 PM - 9:00 PM
        if (daysAgo > 2) { // Only for older days
          const studyStart = new Date(date);
          studyStart.setHours(19, 0, 0, 0);
          const studyStop = new Date(date);
          studyStop.setHours(21, 0, 0, 0);

          await timeLogRepo.save(timeLogRepo.create({
            user_id: demoUser.id,
            button_id: studyButton.id,
            type: 'start',
            timestamp: studyStart,
            timezone: 'Europe/Berlin',
            description: 'Evening study session',
          }));

          await timeLogRepo.save(timeLogRepo.create({
            user_id: demoUser.id,
            button_id: studyButton.id,
            type: 'stop',
            timestamp: studyStop,
            timezone: 'Europe/Berlin',
            description: 'Study session complete',
          }));
        }
      }

      // Exercise on Mon, Wed, Fri
      if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
        const exerciseStart = new Date(date);
        exerciseStart.setHours(6, 30, 0, 0);
        const exerciseStop = new Date(date);
        exerciseStop.setHours(7, 30, 0, 0);

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: exerciseButton.id,
          type: 'start',
          timestamp: exerciseStart,
          timezone: 'Europe/Berlin',
          description: 'Morning workout',
        }));

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: exerciseButton.id,
          type: 'stop',
          timestamp: exerciseStop,
          timezone: 'Europe/Berlin',
          description: 'Workout complete',
        }));
      }

      // Side project on weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const projectStart = new Date(date);
        projectStart.setHours(10, 0, 0, 0);
        const projectStop = new Date(date);
        projectStop.setHours(13, 30, 0, 0);

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: projectButton.id,
          type: 'start',
          timestamp: projectStart,
          timezone: 'Europe/Berlin',
          description: 'Weekend coding session',
        }));

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          button_id: projectButton.id,
          type: 'stop',
          timestamp: projectStop,
          timezone: 'Europe/Berlin',
          description: 'Project work done',
        }));
      }
    }

    // Add an active timer for today (only start, no stop)
    const activeStart = new Date();
    activeStart.setHours(activeStart.getHours() - 2, 0, 0, 0);
    
    await timeLogRepo.save(timeLogRepo.create({
      user_id: demoUser.id,
      button_id: workButton.id,
      type: 'start',
      timestamp: activeStart,
      timezone: 'Europe/Berlin',
      description: 'Currently working',
    }));

    console.log('✅ Created sample time logs for the past week');
    console.log('   - Including an active timer for demo user');

    // Create sample holidays for current year
    // console.log('🎉 Creating sample holidays...');
    // const holidayRepo = AppDataSource.getRepository(Holiday);
    // const currentYear = now.getFullYear();

    // const holidays = [
    //   // US Holidays
    //   { country: 'US', date: new Date(currentYear, 0, 1), name: "New Year's Day" },
    //   { country: 'US', date: new Date(currentYear, 6, 4), name: 'Independence Day' },
    //   { country: 'US', date: new Date(currentYear, 10, 28), name: 'Thanksgiving' },
    //   { country: 'US', date: new Date(currentYear, 11, 25), name: 'Christmas Day' },
      
    //   // German Holidays
    //   { country: 'DE', date: new Date(currentYear, 0, 1), name: 'Neujahr' },
    //   { country: 'DE', date: new Date(currentYear, 4, 1), name: 'Tag der Arbeit' },
    //   { country: 'DE', date: new Date(currentYear, 9, 3), name: 'Tag der Deutschen Einheit' },
    //   { country: 'DE', date: new Date(currentYear, 11, 25), name: '1. Weihnachtsfeiertag' },
    //   { country: 'DE', date: new Date(currentYear, 11, 26), name: '2. Weihnachtsfeiertag' },
    // ];

    // for (const holiday of holidays) {
    //   await holidayRepo.save(holidayRepo.create({
    //     country: holiday.country,
    //     date: holiday.date,
    //     name: holiday.name,
    //     year: currentYear,
    //   }));
    // }

    // console.log('✅ Created 9 sample holidays');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - 2 users created (demo@example.com, test@example.com)');
    console.log('   - 2 daily targets created (Work: Mon-Fri 8h, Study: Tue/Thu 2h)');
    console.log('   - 5 buttons created (2 linked to targets)');
    console.log('   - Sample time logs for past 7 days with timezones');
    console.log('   - 1 active timer');
    console.log('   - 9 holidays');
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
