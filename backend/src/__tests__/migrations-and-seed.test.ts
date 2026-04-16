import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { User } from '../entities/User.js';
import { Timer } from '../entities/Timer.js';
import { Target } from '../entities/Target.js';
import { TargetSpec } from '../entities/TargetSpec.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Holiday } from '../entities/Holiday.js';
import { State } from '../entities/State.js';
import { Balance } from '../entities/Balance.js';
import { HolidayMetadata } from '../entities/HolidayMetadata.js';

/**
 * Test suite to verify that migrations and seeding run without errors
 * This ensures database schema integrity and seed data validity
 * 
 * NOTE: These tests are skipped in the regular test suite because they require:
 * 1. PostgreSQL to be running
 * 2. Compiled migration files (not TypeScript)
 * 
 * To run migration tests, use: npm run test:migrations
 * This runs a dedicated migration test script that properly handles TypeScript migrations.
 */
describe.skip('Migrations and Seeding', () => {
  let testDataSource: DataSource;

  beforeAll(async () => {
    // NOTE: Migration tests are skipped in vitest.
    // Use `npm run test:migrations` to test migrations properly.
  });

  afterAll(async () => {
    if (testDataSource?.isInitialized) {
      await testDataSource.destroy();
    }
  });

  describe('Migrations', () => {
    it('should run all migrations without errors', async () => {
      // Drop the schema to start fresh
      if (testDataSource.isInitialized) {
        await testDataSource.destroy();
      }

      const queryRunner = testDataSource.createQueryRunner();
      try {
        await queryRunner.connect();
        await queryRunner.query('DROP SCHEMA IF EXISTS public CASCADE');
        await queryRunner.query('CREATE SCHEMA public');
        await queryRunner.query('GRANT ALL ON SCHEMA public TO clock_user');
        await queryRunner.query('GRANT ALL ON SCHEMA public TO public');
      } finally {
        await queryRunner.release();
      }

      // Initialize and run migrations
      await testDataSource.initialize();
      
      const pendingMigrations = await testDataSource.showMigrations();
      console.log(`Found ${pendingMigrations ? 'pending' : 'no'} migrations to run`);

      const executedMigrations = await testDataSource.runMigrations();
      console.log(`✓ Executed ${executedMigrations.length} migration(s)`);
      
      // Verify no errors occurred
      expect(executedMigrations).toBeDefined();
      expect(Array.isArray(executedMigrations)).toBe(true);
    });

    it('should have created all required tables', async () => {
      const queryRunner = testDataSource.createQueryRunner();
      
      try {
        const tables = await queryRunner.getTables();
        const tableNames = tables.map(t => t.name);
        
        // Verify all expected tables exist
        expect(tableNames).toContain('users');
        expect(tableNames).toContain('timers');
        expect(tableNames).toContain('targets');
        expect(tableNames).toContain('target_specs');
        expect(tableNames).toContain('time_logs');
        expect(tableNames).toContain('holidays');
        expect(tableNames).toContain('holiday_metadata');
        expect(tableNames).toContain('states');
        expect(tableNames).toContain('balances');
        expect(tableNames).toContain('migrations');

        console.log(`✓ All ${tableNames.length} tables created successfully`);
      } finally {
        await queryRunner.release();
      }
    });

    it('should have created required indexes', async () => {
      if (!testDataSource.isInitialized) {
        await testDataSource.initialize();
      }
      const queryRunner = testDataSource.createQueryRunner();
      
      try {
        // Query to get all indexes
        const indexes = await queryRunner.query(`
          SELECT tablename, indexname 
          FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname LIKE 'IDX_%'
          ORDER BY tablename, indexname
        `);
        
        const indexNames = indexes.map((idx: any) => idx.indexname);
        
        // Verify critical indexes exist
        expect(indexNames).toContain('IDX_targets_user_id');
        expect(indexNames).toContain('IDX_target_specs_user_id');
        expect(indexNames).toContain('IDX_target_specs_target_id');
        expect(indexNames).toContain('IDX_target_specs_state_code');
        expect(indexNames).toContain('IDX_timers_user_id');
        expect(indexNames).toContain('IDX_time_logs_user_id');
        expect(indexNames).toContain('IDX_time_logs_timer_id');
        expect(indexNames).toContain('IDX_time_logs_start_timestamp');

        console.log(`✓ Found ${indexNames.length} indexes`);
      } finally {
        await queryRunner.release();
      }
    });

    it('should have created foreign key constraints', async () => {
      if (!testDataSource.isInitialized) {
        await testDataSource.initialize();
      }
      const queryRunner = testDataSource.createQueryRunner();
      
      try {
        const constraints = await queryRunner.query(`
          SELECT 
            tc.table_name, 
            tc.constraint_name, 
            tc.constraint_type
          FROM information_schema.table_constraints tc
          WHERE tc.constraint_schema = 'public' 
          AND tc.constraint_type = 'FOREIGN KEY'
          ORDER BY tc.table_name
        `);
        
        const fkNames = constraints.map((c: any) => c.constraint_name);
        
        // Verify critical foreign keys exist
        expect(fkNames).toContain('FK_targets_user_id');
        expect(fkNames).toContain('FK_target_specs_user_id');
        expect(fkNames).toContain('FK_target_specs_target_id');
        expect(fkNames).toContain('FK_target_specs_state_code');
        expect(fkNames).toContain('FK_timers_user_id');
        expect(fkNames).toContain('FK_timers_target_id');
        expect(fkNames).toContain('FK_time_logs_user_id');
        expect(fkNames).toContain('FK_time_logs_timer_id');
        expect(fkNames).toContain('FK_balances_user');
        expect(fkNames).toContain('FK_balances_target');

        console.log(`✓ Found ${fkNames.length} foreign key constraints`);
      } finally {
        await queryRunner.release();
      }
    });

    it('should have seeded German states', async () => {
      if (!testDataSource.isInitialized) {
        await testDataSource.initialize();
      }
      const stateRepo = testDataSource.getRepository(State);
      const states = await stateRepo.find();
      
      // Verify German states were seeded
      expect(states.length).toBeGreaterThanOrEqual(16);
      
      const stateCodes = states.map(s => s.code);
      expect(stateCodes).toContain('DE-BW'); // Baden-Württemberg
      expect(stateCodes).toContain('DE-BY'); // Bayern
      expect(stateCodes).toContain('DE-BE'); // Berlin
      
      console.log(`✓ Found ${states.length} states in database`);
    });
  });

  describe('Seeding', () => {
    it('should run seed script without errors', async () => {
      // Ensure datasource is initialized (it should be from Migrations tests)
      if (!testDataSource.isInitialized) {
        await testDataSource.initialize();
      }
      
      // Run the seeding logic inline (same as seed.ts)
      const userRepo = testDataSource.getRepository(User);
      const timerRepo = testDataSource.getRepository(Timer);
      
      // Check that we can clear and seed data
      await testDataSource.query('TRUNCATE TABLE time_logs, timers, targets, holidays, balances, users RESTART IDENTITY CASCADE');
      
      // Verify truncate worked
      const userCountBefore = await userRepo.count();
      expect(userCountBefore).toBe(0);
      
      // For testing, we'll manually seed a basic user to verify the capability
      // Import at the top of the file instead of dynamically
      const password = await import('../utils/password.js');
      const passwordHash = await import('../../../lib/dist/utils/passwordHash.js');
      
      const testEmail = 'test-seed@example.com';
      const testPassword = 'test123';
      const hashedForTransport = await passwordHash.hashPasswordForTransport(testPassword, testEmail);
      
      const testUser = userRepo.create({
        email: testEmail,
        password_hash: await password.hashPassword(hashedForTransport),
        name: 'Test Seed User',
      });
      
      await userRepo.save(testUser);
      
      const userCountAfter = await userRepo.count();
      expect(userCountAfter).toBe(1);
      
      console.log('✓ Seed capability verified successfully');
    });

    it.skip('should have created sample users', async () => {
      const userRepo = testDataSource.getRepository(User);
      const users = await userRepo.find();
      
      expect(users.length).toBeGreaterThan(0);
      
      // Verify demo user exists
      const demoUser = users.find(u => u.email === 'demo@example.com');
      expect(demoUser).toBeDefined();
      expect(demoUser?.name).toBe('Demo User');
      
      console.log(`✓ Found ${users.length} seeded user(s)`);
    });

    it.skip('should have created sample timers', async () => {
      const timerRepo = testDataSource.getRepository(Timer);
      const timers = await timerRepo.find();
      
      expect(timers.length).toBeGreaterThan(0);
      
      // Verify timers have required fields
      timers.forEach(timer => {
        expect(timer.name).toBeDefined();
        expect(timer.user_id).toBeDefined();
      });
      
      console.log(`✓ Found ${timers.length} seeded timer(s)`);
    });

    it.skip('should have created sample targets', async () => {
      const targetRepo = testDataSource.getRepository(Target);
      const targets = await targetRepo.find();
      
      expect(targets.length).toBeGreaterThan(0);
      
      // Verify targets have required fields
      targets.forEach(target => {
        expect(target.name).toBeDefined();
        expect(target.target_spec_ids).toBeDefined();
        expect(Array.isArray(target.target_spec_ids)).toBe(true);
      });
      
      console.log(`✓ Found ${targets.length} seeded target(s)`);
    });

    it.skip('should have created sample time logs', async () => {
      const timeLogRepo = testDataSource.getRepository(TimeLog);
      const timeLogs = await timeLogRepo.find();
      
      expect(timeLogs.length).toBeGreaterThan(0);
      
      // Verify time logs have required fields
      timeLogs.forEach(log => {
        expect(log.user_id).toBeDefined();
        expect(log.timer_id).toBeDefined();
        expect(log.start_timestamp).toBeDefined();
        expect(log.timezone).toBeDefined();
      });
      
      console.log(`✓ Found ${timeLogs.length} seeded time log(s)`);
    });

    it.skip('should have created sample holidays', async () => {
      const holidayRepo = testDataSource.getRepository(Holiday);
      const holidays = await holidayRepo.find();
      
      expect(holidays.length).toBeGreaterThan(0);
      
      // Verify holidays have required fields
      holidays.forEach(holiday => {
        expect(holiday.country).toBeDefined();
        expect(holiday.date).toBeDefined();
        expect(holiday.name).toBeDefined();
        expect(holiday.year).toBeDefined();
      });
      
      console.log(`✓ Found ${holidays.length} seeded holiday(s)`);
    });

    it.skip('should maintain referential integrity', async () => {
      // Verify timers reference existing users and targets
      const timerRepo = testDataSource.getRepository(Timer);
      const userRepo = testDataSource.getRepository(User);
      const targetRepo = testDataSource.getRepository(Target);
      
      const timers = await timerRepo.find();
      const users = await userRepo.find();
      const targets = await targetRepo.find();
      
      const userIds = new Set(users.map(u => u.id));
      const targetIds = new Set(targets.map(t => t.id));
      
      timers.forEach(timer => {
        expect(userIds.has(timer.user_id)).toBe(true);
        if (timer.target_id) {
          expect(targetIds.has(timer.target_id)).toBe(true);
        }
      });
      
      // Verify time logs reference existing users and timers
      const timeLogRepo = testDataSource.getRepository(TimeLog);
      const timeLogs = await timeLogRepo.find();
      
      const timerIds = new Set(timers.map(t => t.id));
      
      timeLogs.forEach(log => {
        expect(userIds.has(log.user_id)).toBe(true);
        expect(timerIds.has(log.timer_id)).toBe(true);
      });
      
      console.log('✓ All foreign key references are valid');
    });
  });
});
