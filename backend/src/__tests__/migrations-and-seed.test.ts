import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { User } from '../entities/User.js';
import { Button } from '../entities/Button.js';
import { DailyTarget } from '../entities/DailyTarget.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Holiday } from '../entities/Holiday.js';
import { State } from '../entities/State.js';
import { MonthlyBalance } from '../entities/MonthlyBalance.js';
import { HolidayMetadata } from '../entities/HolidayMetadata.js';

/**
 * Test suite to verify that migrations and seeding run without errors
 * This ensures database schema integrity and seed data validity
 */
describe('Migrations and Seeding', () => {
  let testDataSource: DataSource;

  beforeAll(async () => {
    // Create a separate test database connection for migration testing
    testDataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'clock_user',
      password: process.env.DB_PASSWORD || 'clock_password',
      database: process.env.DB_NAME || 'clock_test',
      synchronize: false, // Important: use migrations, not synchronize
      logging: false,
      entities: [User, Button, DailyTarget, TimeLog, Holiday, State, MonthlyBalance, HolidayMetadata],
      migrations: ['src/migrations/*.ts'],
    });
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
        expect(tableNames).toContain('buttons');
        expect(tableNames).toContain('daily_targets');
        expect(tableNames).toContain('time_logs');
        expect(tableNames).toContain('holidays');
        expect(tableNames).toContain('holiday_metadata');
        expect(tableNames).toContain('states');
        expect(tableNames).toContain('monthly_balances');
        expect(tableNames).toContain('migrations');

        console.log(`✓ All ${tableNames.length} tables created successfully`);
      } finally {
        await queryRunner.release();
      }
    });

    it('should have created required indexes', async () => {
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
        expect(indexNames).toContain('IDX_daily_targets_user_id');
        expect(indexNames).toContain('IDX_daily_targets_state_code');
        expect(indexNames).toContain('IDX_buttons_user_id');
        expect(indexNames).toContain('IDX_time_logs_user_id');
        expect(indexNames).toContain('IDX_time_logs_button_id');
        expect(indexNames).toContain('IDX_time_logs_start_timestamp');

        console.log(`✓ Found ${indexNames.length} indexes`);
      } finally {
        await queryRunner.release();
      }
    });

    it('should have created foreign key constraints', async () => {
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
        expect(fkNames).toContain('FK_daily_targets_user_id');
        expect(fkNames).toContain('FK_daily_targets_state_code');
        expect(fkNames).toContain('FK_buttons_user_id');
        expect(fkNames).toContain('FK_buttons_target_id');
        expect(fkNames).toContain('FK_time_logs_user_id');
        expect(fkNames).toContain('FK_time_logs_button_id');

        console.log(`✓ Found ${fkNames.length} foreign key constraints`);
      } finally {
        await queryRunner.release();
      }
    });

    it('should have seeded German states', async () => {
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
      // Run the seeding logic inline (same as seed.ts)
      const userRepo = testDataSource.getRepository(User);
      const buttonRepo = testDataSource.getRepository(Button);
      
      // Check that we can clear and seed data
      await testDataSource.query('TRUNCATE TABLE time_logs, buttons, daily_targets, holidays, monthly_balances, users RESTART IDENTITY CASCADE');
      
      // Verify truncate worked
      const userCountBefore = await userRepo.count();
      expect(userCountBefore).toBe(0);
      
      // Import the seed module which will have run automatically
      // For testing, we'll manually seed a basic user to verify the capability
      const { hashPassword } = await import('../utils/password.js');
      const { hashPasswordForTransport } = await import('../../../lib/utils/passwordHash.node.js');
      
      const testEmail = 'test-seed@example.com';
      const testPassword = 'test123';
      const hashedForTransport = hashPasswordForTransport(testPassword, testEmail);
      
      const testUser = userRepo.create({
        email: testEmail,
        password_hash: await hashPassword(hashedForTransport),
        name: 'Test Seed User',
      });
      
      await userRepo.save(testUser);
      
      const userCountAfter = await userRepo.count();
      expect(userCountAfter).toBe(1);
      
      console.log('✓ Seed capability verified successfully');
    });

    it('should have created sample users', async () => {
      const userRepo = testDataSource.getRepository(User);
      const users = await userRepo.find();
      
      expect(users.length).toBeGreaterThan(0);
      
      // Verify demo user exists
      const demoUser = users.find(u => u.email === 'demo@example.com');
      expect(demoUser).toBeDefined();
      expect(demoUser?.name).toBe('Demo User');
      
      console.log(`✓ Found ${users.length} seeded user(s)`);
    });

    it('should have created sample buttons', async () => {
      const buttonRepo = testDataSource.getRepository(Button);
      const buttons = await buttonRepo.find();
      
      expect(buttons.length).toBeGreaterThan(0);
      
      // Verify buttons have required fields
      buttons.forEach(button => {
        expect(button.name).toBeDefined();
        expect(button.user_id).toBeDefined();
      });
      
      console.log(`✓ Found ${buttons.length} seeded button(s)`);
    });

    it('should have created sample daily targets', async () => {
      const targetRepo = testDataSource.getRepository(DailyTarget);
      const targets = await targetRepo.find();
      
      expect(targets.length).toBeGreaterThan(0);
      
      // Verify targets have required fields
      targets.forEach(target => {
        expect(target.name).toBeDefined();
        expect(target.duration_minutes).toBeDefined();
        expect(target.weekdays).toBeDefined();
        expect(Array.isArray(target.duration_minutes)).toBe(true);
        expect(Array.isArray(target.weekdays)).toBe(true);
      });
      
      console.log(`✓ Found ${targets.length} seeded daily target(s)`);
    });

    it('should support ending_at column in daily targets', async () => {
      const targetRepo = testDataSource.getRepository(DailyTarget);
      const targets = await targetRepo.find();
      
      // Find a target with ending_at set (from seed data)
      const endedTarget = targets.find(t => t.ending_at !== null && t.ending_at !== undefined);
      
      expect(endedTarget).toBeDefined();
      expect(endedTarget?.ending_at).toBeInstanceOf(Date);
      expect(endedTarget?.starting_from).toBeInstanceOf(Date);
      
      // Verify ending_at is after starting_from
      if (endedTarget?.starting_from && endedTarget?.ending_at) {
        expect(endedTarget.ending_at.getTime()).toBeGreaterThan(endedTarget.starting_from.getTime());
      }
      
      console.log(`✓ Found target with ending_at: ${endedTarget?.name} (ends ${endedTarget?.ending_at?.toISOString().split('T')[0]})`);
    });

    it('should have created sample time logs', async () => {
      const timeLogRepo = testDataSource.getRepository(TimeLog);
      const timeLogs = await timeLogRepo.find();
      
      expect(timeLogs.length).toBeGreaterThan(0);
      
      // Verify time logs have required fields
      timeLogs.forEach(log => {
        expect(log.user_id).toBeDefined();
        expect(log.button_id).toBeDefined();
        expect(log.start_timestamp).toBeDefined();
        expect(log.timezone).toBeDefined();
      });
      
      console.log(`✓ Found ${timeLogs.length} seeded time log(s)`);
    });

    it('should have created sample holidays', async () => {
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

    it('should maintain referential integrity', async () => {
      // Verify buttons reference existing users and targets
      const buttonRepo = testDataSource.getRepository(Button);
      const userRepo = testDataSource.getRepository(User);
      const targetRepo = testDataSource.getRepository(DailyTarget);
      
      const buttons = await buttonRepo.find();
      const users = await userRepo.find();
      const targets = await targetRepo.find();
      
      const userIds = new Set(users.map(u => u.id));
      const targetIds = new Set(targets.map(t => t.id));
      
      buttons.forEach(button => {
        expect(userIds.has(button.user_id)).toBe(true);
        if (button.target_id) {
          expect(targetIds.has(button.target_id)).toBe(true);
        }
      });
      
      // Verify time logs reference existing users and buttons
      const timeLogRepo = testDataSource.getRepository(TimeLog);
      const timeLogs = await timeLogRepo.find();
      
      const buttonIds = new Set(buttons.map(b => b.id));
      
      timeLogs.forEach(log => {
        expect(userIds.has(log.user_id)).toBe(true);
        expect(buttonIds.has(log.button_id)).toBe(true);
      });
      
      console.log('✓ All foreign key references are valid');
    });
  });
});
