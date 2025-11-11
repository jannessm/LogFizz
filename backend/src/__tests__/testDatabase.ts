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
  
  console.log('✓ Test database initialized');
}
