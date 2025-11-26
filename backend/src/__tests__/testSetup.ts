import { beforeAll, afterAll, vi } from 'vitest';
import { AppDataSource } from '../config/database.js';
import { initializeTestDatabase } from './testDatabase.js';

// Mock hCaptcha verification for tests
vi.mock('../utils/hcaptcha.js', () => ({
  verifyHCaptcha: vi.fn().mockResolvedValue({ success: true }),
  requireHCaptcha: vi.fn().mockResolvedValue(undefined),
  isHCaptchaRequired: vi.fn().mockReturnValue(false),
}));

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
