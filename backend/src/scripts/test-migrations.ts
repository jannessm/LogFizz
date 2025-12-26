#!/usr/bin/env node
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../entities/User.js';
import { Timer } from '../entities/Timer.js';
import { Target } from '../entities/Target.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Holiday } from '../entities/Holiday.js';
import { State } from '../entities/State.js';
import { Balance } from '../entities/Balance.js';
import { HolidayMetadata } from '../entities/HolidayMetadata.js';
import { InitialSchema1699700000000 } from '../migrations/1699700000000-InitialSchema.js';

/**
 * CLI script to test migrations and seeding
 * This creates a temporary test database, runs migrations, and verifies the schema
 * 
 * Usage: npm run test:migrations
 */

const TEST_DB_NAME = 'clock_migration_test';

async function testMigrations() {
  console.log('🧪 Testing database migrations and schema...\n');

  let adminConnection: DataSource | null = null;
  let testConnection: DataSource | null = null;

  try {
    // Step 1: Connect to postgres database to create test database
    console.log('📦 Creating test database...');
    adminConnection = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'clock_user',
      password: process.env.DB_PASSWORD || 'clock_password',
      database: 'postgres',
    });

    await adminConnection.initialize();
    
    // Drop and recreate test database
    await adminConnection.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
    await adminConnection.query(`CREATE DATABASE ${TEST_DB_NAME}`);
    console.log(`✅ Test database '${TEST_DB_NAME}' created\n`);
    
    await adminConnection.destroy();
    adminConnection = null;

    // Step 2: Connect to test database with migrations
    console.log('🔄 Running migrations...');
    testConnection = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'clock_user',
      password: process.env.DB_PASSWORD || 'clock_password',
      database: TEST_DB_NAME,
      synchronize: false,
      logging: false,
      entities: [User, Timer, Target, TimeLog, Holiday, State, Balance, HolidayMetadata],
      migrations: [InitialSchema1699700000000],
    });

    await testConnection.initialize();
    
    const pendingMigrations = await testConnection.showMigrations();
    console.log(`Found ${pendingMigrations ? 'pending' : 'no'} migrations`);

    const executedMigrations = await testConnection.runMigrations();
    console.log(`✅ Executed ${executedMigrations.length} migration(s)\n`);

    // Step 3: Verify schema
    console.log('🔍 Verifying database schema...');
    
    const queryRunner = testConnection.createQueryRunner();
    
    try {
      // Check tables
      const tables = await queryRunner.getTables();
      const tableNames = tables.map(t => t.name);
      
      const expectedTables = [
        'users', 'buttons', 'targets', 'time_logs', 
        'holidays', 'holiday_metadata', 'states', 'balances', 'migrations'
      ];
      
      const missingTables = expectedTables.filter(t => !tableNames.includes(t));
      
      if (missingTables.length > 0) {
        throw new Error(`Missing tables: ${missingTables.join(', ')}`);
      }
      
      console.log(`✅ All ${expectedTables.length} required tables created`);

      // Check indexes
      const indexes = await queryRunner.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname LIKE 'IDX_%'
      `);
      
      console.log(`✅ Created ${indexes.length} indexes`);

      // Check foreign keys
      const foreignKeys = await queryRunner.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public' 
        AND constraint_type = 'FOREIGN KEY'
      `);
      
      console.log(`✅ Created ${foreignKeys.length} foreign key constraints`);

      // Check states seeding
      const states = await queryRunner.query('SELECT COUNT(*) as count FROM states');
      const stateCount = parseInt(states[0].count);
      
      if (stateCount < 16) {
        throw new Error(`Expected at least 16 states, found ${stateCount}`);
      }
      
      console.log(`✅ Seeded ${stateCount} states`);

    } finally {
      await queryRunner.release();
    }

    // Step 4: Test basic seeding capability
    console.log('\n🌱 Testing seeding capability...');
    
    const userRepo = testConnection.getRepository(User);
    const { hashPassword } = await import('../utils/password.js');
    const { hashPasswordForTransport } = await import('../../../lib/utils/passwordHash.js');
    
    const testEmail = 'migration-test@example.com';
    const testPassword = 'test123';
    const hashedForTransport = hashPasswordForTransport(testPassword, testEmail);
    
    const testUser = userRepo.create({
      email: testEmail,
      password_hash: await hashPassword(hashedForTransport),
      name: 'Migration Test User',
    });
    
    await userRepo.save(testUser);
    
    const savedUser = await userRepo.findOne({ where: { email: testEmail } });
    
    if (!savedUser) {
      throw new Error('Failed to save test user');
    }
    
    console.log('✅ Successfully created test user');
    console.log('✅ Seeding capability verified');

    // Step 5: Test foreign key constraints
    console.log('\n🔗 Testing foreign key constraints...');
    
    const timerRepo = testConnection.getRepository(Timer);
    const timer = timerRepo.create({
      user_id: savedUser.id,
      name: 'Test Timer',
      color: '#3B82F6',
    });
    
    await timerRepo.save(timer);
    console.log('✅ Foreign key constraints working correctly');

    // Step 6: Test target creation
    console.log('\n📅 Testing target creation...');
    
    const targetRepo = testConnection.getRepository(Target);
    
    const target = targetRepo.create({
      user_id: savedUser.id,
      name: 'Test Target',
      target_spec_ids: [],
    });
    
    await targetRepo.save(target);
    
    const savedTarget = await targetRepo.findOne({ 
      where: { id: target.id } 
    });
    
    if (!savedTarget) {
      throw new Error('Target not saved correctly');
    }
    
    console.log('✅ Target creation working correctly');

    // Success!
    console.log('\n✅ All migration and schema tests passed! ✅\n');

  } catch (error) {
    console.error('\n❌ Migration test failed:');
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup
    if (testConnection?.isInitialized) {
      await testConnection.destroy();
    }

    if (adminConnection?.isInitialized) {
      await adminConnection.destroy();
    }

    // Optionally drop test database
    if (process.env.KEEP_TEST_DB !== 'true') {
      try {
        const cleanupConnection = new DataSource({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USER || 'clock_user',
          password: process.env.DB_PASSWORD || 'clock_password',
          database: 'postgres',
        });

        await cleanupConnection.initialize();
        await cleanupConnection.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
        await cleanupConnection.destroy();
        console.log('🧹 Test database cleaned up\n');
      } catch (error) {
        console.warn('Warning: Could not clean up test database:', error);
      }
    }
  }
}

// Run the test
testMigrations();
