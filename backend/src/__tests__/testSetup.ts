import { beforeAll, afterAll, vi } from 'vitest';
import { TestDataSource } from '../config/database.test.js';
import { initializeTestDatabase } from './testDatabase.js';

// Mock hCaptcha verification for tests
vi.mock('../utils/hcaptcha.js', () => ({
  verifyHCaptcha: vi.fn().mockResolvedValue({ success: true }),
  requireHCaptcha: vi.fn().mockResolvedValue(undefined),
  isHCaptchaRequired: vi.fn().mockReturnValue(false),
}));

// Mock Redis to prevent connection attempts in tests
vi.mock('../config/redis.js', () => ({
  getRedisClient: vi.fn().mockReturnValue(null),
  createRedisClient: vi.fn().mockReturnValue(null),
  closeRedisClient: vi.fn().mockResolvedValue(undefined),
}));

// Mock the production database to use test database
vi.mock('../config/database.js', async () => {
  const testDb = await import('../config/database.test.js');
  return {
    AppDataSource: testDb.TestDataSource,
  };
});

// Initialize database once before all tests
beforeAll(async () => {
  await initializeTestDatabase();
}, 30000); // 30 second timeout for database initialization

// Cleanup after all tests
afterAll(async () => {
  if (TestDataSource.isInitialized) {
    await TestDataSource.destroy();
  }
});
