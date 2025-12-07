import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database.js';
import { MonthlyBalanceService } from '../services/monthly-balance.service.js';
import { MonthlyBalance } from '../entities/MonthlyBalance.js';

/**
 * Monthly Balance Service Tests
 * 
 * NOTE: Monthly balance calculations are now performed on the frontend.
 * The backend only provides sync/storage functionality.
 * These tests verify the sync API and service methods work correctly.
 */
describe('Monthly Balance Service - Sync Only', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let userId: string;
  let targetId: string;
  let monthlyBalanceService: MonthlyBalanceService;
  let monthlyBalanceRepository: any;

  beforeAll(async () => {
    app = await buildApp();
    monthlyBalanceService = new MonthlyBalanceService();
    monthlyBalanceRepository = AppDataSource.getRepository(MonthlyBalance);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database - use query builder to delete all records
    await AppDataSource.getRepository('MonthlyBalance').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('TimeLog').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('Button').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('DailyTarget').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('User').createQueryBuilder().delete().execute();

    // Register and login
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'balance@test.com',
        password: 'password123',
        name: 'Balance Test',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'balance@test.com',
        password: 'password123',
      },
    });

    sessionCookie = loginResponse.headers['set-cookie'] as string;
    userId = JSON.parse(registerResponse.payload).id;

    // Create a target for tests that need it
    await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: { cookie: sessionCookie },
      payload: {
        targets: [{
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Test Target',
          duration_minutes: [480],
          weekdays: [1],
          exclude_holidays: false,
          starting_from: '2025-01-01T00:00:00.000Z',
        }],
      },
    });

    targetId = '550e8400-e29b-41d4-a716-446655440001';
  });

  describe('Sync API', () => {
    it('should return empty array when no monthly balances exist', async () => {
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/monthly-balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.monthlyBalances).toEqual([]);
      expect(data.cursor).toBeDefined();
    });

    it('should reject sync request without authentication', async () => {
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/monthly-balances/sync?since=1970-01-01T00:00:00.000Z',
      });

      expect(syncResponse.statusCode).toBe(401);
    });
  });

  describe('Service Methods', () => {
    it('should get monthly balance by user, target, year, and month', async () => {
      const balance = monthlyBalanceRepository.create({
        user_id: userId,
        target_id: targetId,
        year: 2025,
        month: 1,
        worked_minutes: 480,
        due_minutes: 1920,
        balance_minutes: -1440,
        exclude_holidays: false,
      });
      await monthlyBalanceRepository.save(balance);

      const result = await monthlyBalanceService.getMonthlyBalance(userId, targetId, 2025, 1);

      expect(result).toBeDefined();
      expect(result?.worked_minutes).toBe(480);
    });

    it('should return null when monthly balance does not exist', async () => {
      const result = await monthlyBalanceService.getMonthlyBalance(userId, targetId, 2025, 1);
      expect(result).toBeNull();
    });
  });
});
