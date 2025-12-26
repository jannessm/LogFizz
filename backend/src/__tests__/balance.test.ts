import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database.js';
import { BalanceService } from '../services/balance.service.js';
import { Balance } from '../entities/Balance.js';

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
  let balanceService: BalanceService;
  let balanceRepository: any;

  beforeAll(async () => {
    app = await buildApp();
    balanceService = new BalanceService();
    balanceRepository = AppDataSource.getRepository(Balance);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database - use query builder to delete all records
    await AppDataSource.getRepository('Balance').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('TimeLog').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('Timer').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('TargetSpec').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('Target').createQueryBuilder().delete().execute();
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
        url: '/api/balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.balances).toEqual([]);
      expect(data.cursor).toBeDefined();
    });

    it('should reject sync request without authentication', async () => {
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/balances/sync?since=1970-01-01T00:00:00.000Z',
      });

      expect(syncResponse.statusCode).toBe(401);
    });
  });
});
