import 'reflect-metadata';
import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { Timer } from '../entities/Timer.js';
import { Target } from '../entities/Target.js';
import { TargetSpec } from '../entities/TargetSpec.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Holiday } from '../entities/Holiday.js';
import { hashPassword } from '../utils/password.js';
import { hashPasswordForTransport } from '../../../lib/utils/passwordHash.js';
import { HolidayCrawlerService } from '../services/holiday-crawler.service.js';

/**
 * Seed script for development environment
 * Creates sample users, timers, time logs, and holidays
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
      await AppDataSource.query('TRUNCATE TABLE time_logs, timers, target_specs, targets, holidays, holiday_metadata, users RESTART IDENTITY CASCADE');
      console.log('✅ Existing data cleared');
    }

    // Fetch holidays for German states used in seed data
    console.log('🎄 Fetching holiday data...');
    const holidayCrawler = new HolidayCrawlerService();
    
    // Fetch holidays for 2025 and 2026 for Germany
    const years = [2025, 2026];
    for (const year of years) {
      const result = await holidayCrawler.crawlHolidays('DE', year, true);
      if (result.success) {
        console.log(`✅ Fetched ${result.holidayCount} holidays for Germany ${year}`);
      } else {
        console.warn(`⚠️  Failed to fetch holidays for Germany ${year}: ${result.message}`);
      }
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Create sample users
    console.log('👤 Creating sample users...');
    const userRepo = AppDataSource.getRepository(User);
    
    // Hash passwords as if they came from the client (SHA-256 with email)
    // Then bcrypt hash them for storage
    const demoEmail = 'demo@example.com';
    const demoPassword = 'demo123';
    const demoHashedForTransport = await hashPasswordForTransport(demoPassword, demoEmail);
    
    const demoUser = userRepo.create({
      email: demoEmail,
      password_hash: await hashPassword(demoHashedForTransport),
      name: 'Demo User',
    });
    await userRepo.save(demoUser);
    
    const testEmail = 'test@example.com';
    const testPassword = 'test123';
    const testHashedForTransport = await hashPasswordForTransport(testPassword, testEmail);
    
    const testUser = userRepo.create({
      email: testEmail,
      password_hash: await hashPassword(testHashedForTransport),
      name: 'Test User',
    });
    await userRepo.save(testUser);
    
    console.log('✅ Created 2 sample users');
    console.log('   - demo@example.com (password: demo123)');
    console.log('   - test@example.com (password: test123)');

    // Create sample targets and target specs for demo user
    console.log('🎯 Creating sample targets...');
    const targetRepo = AppDataSource.getRepository(Target);
    const targetSpecRepo = AppDataSource.getRepository(TargetSpec);
    
    // Create work target with MULTIPLE specs at different times to test the new UI
    const workTarget = targetRepo.create({
      user_id: demoUser.id,
      name: 'Work Target',
      target_spec_ids: [], // Will be updated after creating specs
    });
    await targetRepo.save(workTarget);
    
    // Current spec: January 2026 onwards (back to 8h, with holidays)
    // This is created first since specs should be sorted descending by start date
    const workSpecCurrent = targetSpecRepo.create({
      user_id: demoUser.id,
      target_id: workTarget.id,
      duration_minutes: [0, 480, 480, 480, 480, 480, 0], // Sun-Sat: 0, 8h, 8h, 8h, 8h, 8h, 0
      starting_from: new Date(Date.UTC(2026, 0, 1)), // January 1, 2026
      // No ending_at - this is the current active spec
      exclude_holidays: true,
      state_code: 'DE-BY', // Bavaria
    });
    await targetSpecRepo.save(workSpecCurrent);
    
    // Middle spec: December 2025 (7h workdays - reduced hours)
    // ending_at is 1 day before next spec starts (Dec 31, 2025)
    const workSpecMiddle = targetSpecRepo.create({
      user_id: demoUser.id,
      target_id: workTarget.id,
      duration_minutes: [0, 420, 420, 420, 420, 420, 0], // Sun-Sat: 0, 7h, 7h, 7h, 7h, 7h, 0
      starting_from: new Date(Date.UTC(2025, 11, 1)), // December 1, 2025
      ending_at: new Date(Date.UTC(2025, 11, 31)), // December 31, 2025 (1 day before Jan 1)
      exclude_holidays: true,
      state_code: 'DE-BW', // Baden-Württemberg
    });
    await targetSpecRepo.save(workSpecMiddle);
    
    // Oldest spec: October-November 2025 (8h workdays)
    // ending_at is 1 day before next spec starts (Nov 30, 2025)
    const workSpecOld = targetSpecRepo.create({
      user_id: demoUser.id,
      target_id: workTarget.id,
      duration_minutes: [0, 480, 480, 480, 480, 480, 0], // Sun-Sat: 0, 8h, 8h, 8h, 8h, 8h, 0
      starting_from: new Date(Date.UTC(2025, 9, 1)), // October 1, 2025
      ending_at: new Date(Date.UTC(2025, 10, 30)), // November 30, 2025 (1 day before Dec 1)
      exclude_holidays: false,
    });
    await targetSpecRepo.save(workSpecOld);
    
    workTarget.target_spec_ids = [workSpecOld.id, workSpecMiddle.id, workSpecCurrent.id];
    await targetRepo.save(workTarget);

    // Create study target with spec starting from November 2025
    const studyStartingFrom = new Date(Date.UTC(2025, 10, 1)); // November 1, 2025
    const studyTarget = targetRepo.create({
      user_id: demoUser.id,
      name: 'Study Target',
      target_spec_ids: [],
    });
    await targetRepo.save(studyTarget);
    
    const studySpec = targetSpecRepo.create({
      user_id: demoUser.id,
      target_id: studyTarget.id,
      duration_minutes: [0, 0, 120, 0, 120, 0, 0], // Sun-Sat: 0, 0, 2h, 0, 2h, 0, 0
      starting_from: studyStartingFrom,
      exclude_holidays: false,
    });
    await targetSpecRepo.save(studySpec);
    studyTarget.target_spec_ids = [studySpec.id];
    await targetRepo.save(studyTarget);

    // Create exercise target with ending_at date (to test targets that end)
    const exerciseStartingFrom = new Date(Date.UTC(2025, 8, 1)); // September 1, 2025
    const exerciseEndingAt = new Date(Date.UTC(2025, 9, 31)); // October 31, 2025
    const exerciseTarget = targetRepo.create({
      user_id: demoUser.id,
      name: 'Exercise Target (Ended)',
      target_spec_ids: [],
    });
    await targetRepo.save(exerciseTarget);
    
    const exerciseSpec = targetSpecRepo.create({
      user_id: demoUser.id,
      target_id: exerciseTarget.id,
      duration_minutes: [0, 60, 0, 60, 0, 60, 0], // Sun-Sat: 0, 1h, 0, 1h, 0, 1h, 0
      starting_from: exerciseStartingFrom,
      ending_at: exerciseEndingAt,
      exclude_holidays: false,
    });
    await targetSpecRepo.save(exerciseSpec);
    exerciseTarget.target_spec_ids = [exerciseSpec.id];
    await targetRepo.save(exerciseTarget);

    console.log('✅ Created 3 sample targets with specs');
    console.log('   - Work Target: 3 specs (Oct-Nov 2025: 8h, Dec 2025: 7h+DE-BW holidays, Jan 2026+: 8h+DE-BY holidays)');
    console.log('   - Study Target: starting from Nov 2025, Tue/Thu 2h');
    console.log('   - Exercise Target (Ended): Sep-Oct 2025, Mon/Wed/Fri 1h');

    // Create sample timers for demo user
    console.log('⏱️  Creating sample timers...');
    const timerRepo = AppDataSource.getRepository(Timer);
    
    const workTimer = timerRepo.create({
      user_id: demoUser.id,
      name: 'Work',
      emoji: '💼',
      color: '#3B82F6',
      target_id: workTarget.id,
      auto_subtract_breaks: true,
      archived: false,
    });
    await timerRepo.save(workTimer);

    const studyTimer = timerRepo.create({
      user_id: demoUser.id,
      name: 'Study',
      emoji: '📚',
      color: '#10B981',
      target_id: studyTarget.id,
      auto_subtract_breaks: false,
      archived: false,
    });
    await timerRepo.save(studyTimer);

    const exerciseTimer = timerRepo.create({
      user_id: demoUser.id,
      name: 'Exercise',
      emoji: '🏃',
      color: '#EF4444',
      auto_subtract_breaks: false,
      archived: false,
    });
    await timerRepo.save(exerciseTimer);

    const projectTimer = timerRepo.create({
      user_id: demoUser.id,
      name: 'Side Project',
      emoji: '🚀',
      color: '#8B5CF6',
      auto_subtract_breaks: false,
      archived: false,
    });
    await timerRepo.save(projectTimer);

    // Create timers for test user
    const meetingTimer = timerRepo.create({
      user_id: testUser.id,
      name: 'Meetings',
      emoji: '📞',
      color: '#F59E0B',
      auto_subtract_breaks: false,
      archived: false,
    });
    await timerRepo.save(meetingTimer);

    // Create timer linked to the ended exercise target (to test ended target behavior)
    const exerciseTimerOld = timerRepo.create({
      user_id: demoUser.id,
      name: 'Old Exercise',
      emoji: '🏋️',
      color: '#EC4899',
      target_id: exerciseTarget.id,
      auto_subtract_breaks: false,
      archived: true, // Mark as archived for testing
    });
    await timerRepo.save(exerciseTimerOld);

    console.log('✅ Created 6 sample timers (3 linked to targets)');

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
          timer_id: exerciseTimerOld.id,
          start_timestamp: exerciseStart,
          end_timestamp: exerciseEnd,
          timezone: 'Europe/Berlin',
          notes: 'Morning exercise',
          apply_break_calculation: exerciseTimerOld.auto_subtract_breaks,
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
          timer_id: workTimer.id,
          start_timestamp: workStart,
          end_timestamp: workEnd,
          timezone: 'Europe/Berlin',
          notes: 'October work session',
          apply_break_calculation: workTimer.auto_subtract_breaks,
        }));
      }

      // Exercise on Mon, Wed, Fri (matching the target, ends Oct 31)
      if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
        const exerciseStart = new Date(Date.UTC(2025, 9, day, 7, 0, 0));
        const exerciseEnd = new Date(Date.UTC(2025, 9, day, 8, 0, 0)); // 1 hour

        await timeLogRepo.save(timeLogRepo.create({
          user_id: demoUser.id,
          timer_id: exerciseTimerOld.id,
          start_timestamp: exerciseStart,
          end_timestamp: exerciseEnd,
          timezone: 'Europe/Berlin',
          notes: 'Morning exercise (last month)',
          apply_break_calculation: exerciseTimerOld.auto_subtract_breaks,
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
          timer_id: workTimer.id,
          start_timestamp: workStart,
          end_timestamp: workEnd,
          timezone: 'Europe/Berlin',
          notes: 'November work session',
          apply_break_calculation: workTimer.auto_subtract_breaks,
        }));

        // Study sessions on Tue & Thu
        if (dayOfWeek === 2 || dayOfWeek === 4) {
          const studyStart = new Date(Date.UTC(2025, 10, day, 19, 0, 0));
          const studyEnd = new Date(Date.UTC(2025, 10, day, 21, 0, 0)); // 2 hours

          await timeLogRepo.save(timeLogRepo.create({
            user_id: demoUser.id,
            timer_id: studyTimer.id,
            start_timestamp: studyStart,
            end_timestamp: studyEnd,
            timezone: 'Europe/Berlin',
            notes: 'November study session',
            apply_break_calculation: studyTimer.auto_subtract_breaks,
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
          timer_id: workTimer.id,
          start_timestamp: workStart,
          end_timestamp: workEnd,
          timezone: 'Europe/Berlin',
          notes: 'Work day',
          apply_break_calculation: workTimer.auto_subtract_breaks,
        }));

        // Study session: 7:00 PM - 9:00 PM
        if (daysAgo > 2) { // Only for older days
          const studyStart = new Date(date);
          studyStart.setHours(19, 0, 0, 0);
          const studyEnd = new Date(date);
          studyEnd.setHours(21, 0, 0, 0);

          await timeLogRepo.save(timeLogRepo.create({
            user_id: demoUser.id,
            timer_id: studyTimer.id,
            start_timestamp: studyStart,
            end_timestamp: studyEnd,
            timezone: 'Europe/Berlin',
            notes: 'Evening study session',
            apply_break_calculation: studyTimer.auto_subtract_breaks,
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
          timer_id: exerciseTimer.id,
          start_timestamp: exerciseStart,
          end_timestamp: exerciseEnd,
          timezone: 'Europe/Berlin',
          notes: 'Morning workout',
          apply_break_calculation: exerciseTimer.auto_subtract_breaks,
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
          timer_id: projectTimer.id,
          start_timestamp: projectStart,
          end_timestamp: projectEnd,
          timezone: 'Europe/Berlin',
          notes: 'Weekend coding session',
          apply_break_calculation: projectTimer.auto_subtract_breaks,
        }));
      }
    }

    // Add an active timer for today (only start, no end)
    const activeStart = new Date();
    activeStart.setHours(activeStart.getHours() - 2, 0, 0, 0);
    
    await timeLogRepo.save(timeLogRepo.create({
      user_id: demoUser.id,
      timer_id: workTimer.id,
      start_timestamp: activeStart,
      // No end_timestamp - this is an active timer
      timezone: 'Europe/Berlin',
      notes: 'Currently working',
      apply_break_calculation: workTimer.auto_subtract_breaks,
      type: 'normal',
    }));

    // Add timelogs with different types for debugging
    console.log('   - Creating timelogs with different types for debugging...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sick day (yesterday) - whole day flag set
    const sickDate = new Date(today);
    sickDate.setDate(sickDate.getDate() - 1);
    const sickStart = new Date(sickDate);
    sickStart.setHours(8, 0, 0, 0); // Time doesn't matter with whole_day flag
    
    await timeLogRepo.save(timeLogRepo.create({
      user_id: demoUser.id,
      timer_id: workTimer.id,
      start_timestamp: sickStart,
      end_timestamp: sickStart, // Same as start, whole_day flag is what matters
      timezone: 'Europe/Berlin',
      notes: 'Sick day - stayed home',
      apply_break_calculation: false,
      type: 'sick',
      whole_day: true,
    }));

    // Holiday (2 days ago) - whole day flag set
    const holidayDate = new Date(today);
    holidayDate.setDate(holidayDate.getDate() - 2);
    const holidayStart = new Date(holidayDate);
    holidayStart.setHours(8, 0, 0, 0); // Time doesn't matter with whole_day flag
    
    await timeLogRepo.save(timeLogRepo.create({
      user_id: demoUser.id,
      timer_id: workTimer.id,
      start_timestamp: holidayStart,
      end_timestamp: holidayStart, // Same as start, whole_day flag is what matters
      timezone: 'Europe/Berlin',
      notes: 'Vacation day',
      apply_break_calculation: false,
      type: 'holiday',
      whole_day: true,
    }));

    // Business trip (3 days ago) - normal timelog with specific hours
    const businessTripDate = new Date(today);
    businessTripDate.setDate(businessTripDate.getDate() - 3);
    const businessTripStart = new Date(businessTripDate);
    businessTripStart.setHours(8, 0, 0, 0);
    const businessTripEnd = new Date(businessTripDate);
    businessTripEnd.setHours(18, 0, 0, 0);
    
    await timeLogRepo.save(timeLogRepo.create({
      user_id: demoUser.id,
      timer_id: workTimer.id,
      start_timestamp: businessTripStart,
      end_timestamp: businessTripEnd,
      timezone: 'Europe/Berlin',
      notes: 'Business trip to Berlin office',
      apply_break_calculation: true,
      type: 'business-trip',
      whole_day: false,
    }));

    // Child sick day (4 days ago) - half day, so NOT whole_day
    const childSickDate = new Date(today);
    childSickDate.setDate(childSickDate.getDate() - 4);
    const childSickStart = new Date(childSickDate);
    childSickStart.setHours(8, 0, 0, 0);
    const childSickEnd = new Date(childSickDate);
    childSickEnd.setHours(12, 0, 0, 0);
    
    await timeLogRepo.save(timeLogRepo.create({
      user_id: demoUser.id,
      timer_id: workTimer.id,
      start_timestamp: childSickStart,
      end_timestamp: childSickEnd,
      timezone: 'Europe/Berlin',
      notes: 'Taking care of sick child - half day',
      apply_break_calculation: false,
      type: 'child-sick',
      whole_day: false, // Half day - use actual time range
    }));

    // Normal work day with explicit type (5 days ago)
    const normalDate = new Date(today);
    normalDate.setDate(normalDate.getDate() - 5);
    const normalStart = new Date(normalDate);
    normalStart.setHours(9, 0, 0, 0);
    const normalEnd = new Date(normalDate);
    normalEnd.setHours(17, 30, 0, 0);
    
    await timeLogRepo.save(timeLogRepo.create({
      user_id: demoUser.id,
      timer_id: workTimer.id,
      start_timestamp: normalStart,
      end_timestamp: normalEnd,
      timezone: 'Europe/Berlin',
      notes: 'Regular work day with explicit type',
      apply_break_calculation: true,
      type: 'normal',
      whole_day: false,
    }));

    // Multi-day holiday (6-9 days ago - 4 consecutive days)
    // Create individual whole-day entries for each day
    for (let daysAgo = 9; daysAgo >= 6; daysAgo--) {
      const holidayMultiDate = new Date(today);
      holidayMultiDate.setDate(holidayMultiDate.getDate() - daysAgo);
      const holidayMultiStart = new Date(holidayMultiDate);
      holidayMultiStart.setHours(8, 0, 0, 0);
      
      await timeLogRepo.save(timeLogRepo.create({
        user_id: demoUser.id,
        timer_id: workTimer.id,
        start_timestamp: holidayMultiStart,
        end_timestamp: holidayMultiStart,
        timezone: 'Europe/Berlin',
        notes: `Multi-day vacation - day ${10 - daysAgo} of 4`,
        apply_break_calculation: false,
        type: 'holiday',
        whole_day: true,
      }));
    }

    // Multi-day sick leave (10-11 days ago - 2 consecutive days)
    // Create individual whole-day entries for each day
    for (let daysAgo = 11; daysAgo >= 10; daysAgo--) {
      const sickMultiDate = new Date(today);
      sickMultiDate.setDate(sickMultiDate.getDate() - daysAgo);
      const sickMultiStart = new Date(sickMultiDate);
      sickMultiStart.setHours(8, 0, 0, 0);
      
      await timeLogRepo.save(timeLogRepo.create({
        user_id: demoUser.id,
        timer_id: workTimer.id,
        start_timestamp: sickMultiStart,
        end_timestamp: sickMultiStart,
        timezone: 'Europe/Berlin',
        notes: `Sick leave - day ${12 - daysAgo} of 2`,
        apply_break_calculation: false,
        type: 'sick',
        whole_day: true,
      }));
    }

    console.log('✅ Created sample time logs');
    console.log('   - September 2025: Exercise sessions (1h Mon/Wed/Fri)');
    console.log('   - October 2025: Full work days (8h each weekday) + Exercise (ended Oct 31)');
    console.log('   - November 2025: Work + overtime (8.5h/day) and study sessions');
    console.log('   - Current week: Regular time logs');
    console.log('   - Including an active timer for demo user');
    console.log('   - Different types with whole_day flag:');
    console.log('     * Sick days: whole_day=true (counts as full day)');
    console.log('     * Holidays: whole_day=true (counts as full day)');
    console.log('     * Child-sick: whole_day=false (half-day, uses time range)');
    console.log('     * Business-trip: whole_day=false (uses time range)');
    console.log('     * Normal: whole_day=false (uses time range)');
    console.log('   - Multi-day timelogs: 4 individual holiday entries and 2 individual sick entries');

    

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - German holidays fetched for 2025-2026');
    console.log('   - 2 users created (demo@example.com, test@example.com)');
    console.log('   - 3 targets created:');
    console.log('     * Work: Mon-Fri 8h, starting Oct 2025');
    console.log('     * Study: Tue/Thu 2h, starting Nov 2025');
    console.log('     * Exercise (Ended): Mon/Wed/Fri 1h, Sep-Oct 2025 (with ending_at date)');
    console.log('   - 6 timers created (3 linked to targets)');
    console.log('   - Historical time logs for Sep-Nov 2025 (for testing cumulative balance & ended targets)');
    console.log('   - Current week time logs with various types (normal, sick, holiday, business-trip, child-sick)');
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
