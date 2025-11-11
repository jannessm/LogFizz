import { beforeAll, afterAll } from 'vitest';
import { AppDataSource } from '../config/database.js';
import { initializeTestDatabase } from './testDatabase.js';

// Initialize database once before all tests
beforeAll(async () => {
  await initializeTestDatabase();
}, 30000); // 30 second timeout for database initialization

// Cleanup after all tests
afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});
