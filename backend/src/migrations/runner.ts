import { AppDataSource } from '../config/database.js';

export async function runMigrations() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    console.log('Skipping migrations in development mode (using synchronize)');
    return;
  }

  try {
    console.log('Running database migrations...');
    await AppDataSource.runMigrations();
    console.log('✓ Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}
