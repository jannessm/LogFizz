import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database.js';

/**
 * Clean the test database by dropping all schemas and recreating them
 * This is more thorough than just dropSchema as it handles enum types
 */
export async function cleanTestDatabase() {
  if (!AppDataSource.isInitialized) {
    return;
  }

  const queryRunner = AppDataSource.createQueryRunner();
  
  try {
    // Drop all tables with CASCADE to remove dependencies
    await queryRunner.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO clock_user;
      GRANT ALL ON SCHEMA public TO public;
    `);
    
    // Reinstall required extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    
    console.log('✓ Test database cleaned');
  } catch (error) {
    console.error('Error cleaning test database:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}

/**
 * Initialize test database with fresh schema
 */
export async function initializeTestDatabase() {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  
  await AppDataSource.initialize();
  
  // In test mode, synchronize will create all tables
  // But we need to ensure clean state first
  await cleanTestDatabase();
  
  // Force synchronize to recreate tables
  await AppDataSource.synchronize(true);
  
  // Seed German states (required for target_state_entries tests)
  await seedGermanStates();
  
  console.log('✓ Test database initialized');
}

/**
 * Seed German states into the database
 */
async function seedGermanStates() {
  const queryRunner = AppDataSource.createQueryRunner();
  
  try {
    await queryRunner.query(`
      INSERT INTO "states" ("country", "state", "code") VALUES
      ('Germany', 'Baden-Württemberg', 'DE-BW'),
      ('Germany', 'Bayern', 'DE-BY'),
      ('Germany', 'Berlin', 'DE-BE'),
      ('Germany', 'Brandenburg', 'DE-BB'),
      ('Germany', 'Bremen', 'DE-HB'),
      ('Germany', 'Hamburg', 'DE-HH'),
      ('Germany', 'Hessen', 'DE-HE'),
      ('Germany', 'Mecklenburg-Vorpommern', 'DE-MV'),
      ('Germany', 'Niedersachsen', 'DE-NI'),
      ('Germany', 'Nordrhein-Westfalen', 'DE-NW'),
      ('Germany', 'Rheinland-Pfalz', 'DE-RP'),
      ('Germany', 'Saarland', 'DE-SL'),
      ('Germany', 'Sachsen', 'DE-SN'),
      ('Germany', 'Sachsen-Anhalt', 'DE-ST'),
      ('Germany', 'Schleswig-Holstein', 'DE-SH'),
      ('Germany', 'Thüringen', 'DE-TH')
      ON CONFLICT (code) DO NOTHING
    `);
    
    console.log('✓ German states seeded');
  } catch (error) {
    console.error('Error seeding German states:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}
