import 'reflect-metadata';
import { AppDataSource } from '../config/database.js';
import { seed } from './seed.js';

/**
 * Reset script – drops all application tables, re-synchronises the schema,
 * then re-runs the seed script.
 *
 * Usage: npm run db:reset
 *
 * Safety: refuses to run in production.
 */

async function resetDb() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌  Refusing to reset the database in production!');
    process.exit(1);
  }

  try {
    console.log('🔄  Resetting database to a fresh seed...');

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅  Database connection established');
    }

    console.log('🧹  Dropping all tables...');
    await AppDataSource.dropDatabase();
    console.log('✅  All tables dropped');

    console.log('🏗   Re-synchronising schema...');
    await AppDataSource.synchronize();
    console.log('✅  Schema synchronised');

    await AppDataSource.destroy();
    console.log('🌱  Running seed...');
    await seed();
    console.log('✅  Database reset complete');
  } catch (error) {
    console.error('❌  Failed to reset database:', error);
    process.exit(1);
  }
}

resetDb();
