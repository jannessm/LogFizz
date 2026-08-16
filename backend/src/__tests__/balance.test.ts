import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database.js';
import { BalanceService } from '../services/balance.service.js';
import { Balance } from '../entities/Balance.js';
import { registerAndAuthenticate } from './testHelpers.js';

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
    await AppDataSource.getRepository('Target').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('User').createQueryBuilder().delete().execute();

    // Register and authenticate via magic link
    const result = await registerAndAuthenticate(app, {
      email: 'balance@test.com',
      name: 'Balance Test',
    });

    sessionCookie = result.authCookie;
    userId = result.userId;

    // Create a target for tests that need it
    await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: { cookie: sessionCookie },
      payload: {
        targets: [{
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Test Target',
          target_specs: [{
            id: '550e8400-e29b-41d4-a716-446655440002',
            duration_minutes: [0, 480, 0, 0, 0, 0, 0], // Sun-Sat: Only Monday has 480
            exclude_holidays: false,
            starting_from: '2025-01-01T00:00:00.000Z',
          }],
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

    it('should push new balance and return it in saved', async () => {
      const balanceDate = '2025-01';
      const expectedId = `${targetId}_${balanceDate}`;
      
      const pushResponse = await app.inject({
        method: 'POST',
        url: '/api/balances/sync',
        headers: { cookie: sessionCookie },
        payload: {
          balances: [{
            target_id: targetId,
            date: balanceDate,
            due_minutes: 9600,
            worked_minutes: 9000,
            cumulative_minutes: -600,
            sick_days: 1,
            holidays: 0,
            business_trip: 0,
            child_sick: 0,
            homeoffice: 0,
            normal_days: 0,
            worked_days: 19,
          }],
        },
      });

      expect(pushResponse.statusCode).toBe(200);
      const data = JSON.parse(pushResponse.payload);
      
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].id).toBe(expectedId);
      expect(data.saved[0].target_id).toBe(targetId);
      expect(data.saved[0].date).toBe('2025-01');
      expect(data.saved[0].due_minutes).toBe(9600);
      expect(data.saved[0].worked_minutes).toBe(9000);
      expect(data.cursor).toBeDefined();
      expect(data.conflicts).toBeUndefined();
    });

    it('should update existing balance', async () => {
      const balanceDate = '2025-02';
      const expectedId = `${targetId}_${balanceDate}`;
      
      // Create initial balance
      await app.inject({
        method: 'POST',
        url: '/api/balances/sync',
        headers: { cookie: sessionCookie },
        payload: {
          balances: [{
            target_id: targetId,
            date: balanceDate,
            due_minutes: 9600,
            worked_minutes: 8000,
            cumulative_minutes: -1600,
            sick_days: 0,
            holidays: 0,
            business_trip: 0,
            child_sick: 0,
            homeoffice: 0,
            normal_days: 0,
            worked_days: 20,
          }],
        },
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update the balance
      const updateResponse = await app.inject({
        method: 'POST',
        url: '/api/balances/sync',
        headers: { cookie: sessionCookie },
        payload: {
          balances: [{
            target_id: targetId,
            date: balanceDate,
            due_minutes: 9600,
            worked_minutes: 9500, // Changed
            cumulative_minutes: -100, // Changed
            sick_days: 0,
            holidays: 0,
            business_trip: 0,
            child_sick: 0,
            homeoffice: 0,
            normal_days: 0,
            worked_days: 20,
          }],
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      const data = JSON.parse(updateResponse.payload);
      
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].id).toBe(expectedId);
      expect(data.saved[0].worked_minutes).toBe(9500);
      expect(data.saved[0].cumulative_minutes).toBe(-100);
      expect(data.conflicts).toBeUndefined();
    });

    it('should always accept client data even when server has a newer timestamp', async () => {
      const balanceDate = '2025-03';
      const expectedId = `${targetId}_${balanceDate}`;
      
      // Create initial balance
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/balances/sync',
        headers: { cookie: sessionCookie },
        payload: {
          balances: [{
            target_id: targetId,
            date: balanceDate,
            due_minutes: 9600,
            worked_minutes: 8000,
            cumulative_minutes: -1600,
            sick_days: 0,
            holidays: 0,
            business_trip: 0,
            child_sick: 0,
            homeoffice: 0,
            normal_days: 0,
            worked_days: 20,
          }],
        },
      });

      const serverUpdatedAt = JSON.parse(createResponse.payload).saved[0].updated_at;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Push with an older timestamp — should still be saved (client wins, no conflict)
      const updateResponse = await app.inject({
        method: 'POST',
        url: '/api/balances/sync',
        headers: { cookie: sessionCookie },
        payload: {
          balances: [{
            id: expectedId,
            target_id: targetId,
            date: balanceDate,
            due_minutes: 9600,
            worked_minutes: 7000, // Recalculated value
            cumulative_minutes: -2600,
            sick_days: 0,
            holidays: 0,
            business_trip: 0,
            child_sick: 0,
            homeoffice: 0,
            normal_days: 0,
            worked_days: 20,
            updated_at: new Date(new Date(serverUpdatedAt).getTime() - 1000).toISOString(), // Old timestamp
          }],
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      const data = JSON.parse(updateResponse.payload);

      // Client data must be saved — no conflicts returned
      expect(data.conflicts).toBeUndefined();
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].id).toBe(expectedId);
      expect(data.saved[0].worked_minutes).toBe(7000);
      expect(data.saved[0].cumulative_minutes).toBe(-2600);
    });
  });

  describe('Multi-device sync robustness', () => {
    it('should allow Device B to overwrite Device A balance (last-write-wins)', async () => {
      const balanceDate = '2025-04';

      // Device A pushes a balance
      await app.inject({
        method: 'POST',
        url: '/api/balances/sync',
        headers: { cookie: sessionCookie },
        payload: {
          balances: [{
            target_id: targetId,
            date: balanceDate,
            due_minutes: 9600,
            worked_minutes: 8000,
            cumulative_minutes: -1600,
            sick_days: 0,
            holidays: 0,
            business_trip: 0,
            child_sick: 0,
            homeoffice: 0,
            normal_days: 0,
            worked_days: 20,
          }],
        },
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Device B pushes updated balance for same period (more worked minutes)
      const deviceBResponse = await app.inject({
        method: 'POST',
        url: '/api/balances/sync',
        headers: { cookie: sessionCookie },
        payload: {
          balances: [{
            target_id: targetId,
            date: balanceDate,
            due_minutes: 9600,
            worked_minutes: 9200,
            cumulative_minutes: -400,
            sick_days: 0,
            holidays: 0,
            business_trip: 0,
            child_sick: 0,
            homeoffice: 0,
            normal_days: 0,
            worked_days: 21,
          }],
        },
      });

      expect(deviceBResponse.statusCode).toBe(200);
      const data = JSON.parse(deviceBResponse.payload);
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].worked_minutes).toBe(9200);
      expect(data.saved[0].worked_days).toBe(21);
    });

    it('should return latest balance state on pull after multi-device pushes', async () => {
      const balanceDate = '2025-05';

      // Device A pushes
      const pushA = await app.inject({
        method: 'POST',
        url: '/api/balances/sync',
        headers: { cookie: sessionCookie },
        payload: {
          balances: [{
            target_id: targetId,
            date: balanceDate,
            due_minutes: 9600,
            worked_minutes: 5000,
            cumulative_minutes: -4600,
            sick_days: 0,
            holidays: 0,
            business_trip: 0,
            child_sick: 0,
            homeoffice: 0,
            normal_days: 0,
            worked_days: 15,
          }],
        },
      });
      const cursorAfterA = JSON.parse(pushA.payload).cursor;

      await new Promise(resolve => setTimeout(resolve, 50));

      // Device B pushes (newer, more accurate)
      await app.inject({
        method: 'POST',
        url: '/api/balances/sync',
        headers: { cookie: sessionCookie },
        payload: {
          balances: [{
            target_id: targetId,
            date: balanceDate,
            due_minutes: 9600,
            worked_minutes: 9600,
            cumulative_minutes: 0,
            sick_days: 0,
            holidays: 0,
            business_trip: 0,
            child_sick: 0,
            homeoffice: 0,
            normal_days: 0,
            worked_days: 22,
          }],
        },
      });

      // Device A pulls using its old cursor — should see Device B's update
      const pullResponse = await app.inject({
        method: 'GET',
        url: `/api/balances/sync?since=${cursorAfterA}`,
        headers: { cookie: sessionCookie },
      });

      expect(pullResponse.statusCode).toBe(200);
      const pullData = JSON.parse(pullResponse.payload);
      expect(pullData.balances).toHaveLength(1);
      expect(pullData.balances[0].worked_minutes).toBe(9600);
      expect(pullData.balances[0].worked_days).toBe(22);
    });

    it('should handle bulk balance push for multiple periods', async () => {
      const pushResponse = await app.inject({
        method: 'POST',
        url: '/api/balances/sync',
        headers: { cookie: sessionCookie },
        payload: {
          balances: [
            {
              target_id: targetId,
              date: '2025-01',
              due_minutes: 9600,
              worked_minutes: 9000,
              cumulative_minutes: 0,
              sick_days: 0,
              holidays: 0,
              business_trip: 0,
              child_sick: 0,
              homeoffice: 0,
              normal_days: 0,
              worked_days: 20,
            },
            {
              target_id: targetId,
              date: '2025-02',
              due_minutes: 8000,
              worked_minutes: 8500,
              cumulative_minutes: -600,
              sick_days: 1,
              holidays: 0,
              business_trip: 0,
              child_sick: 0,
              homeoffice: 0,
              normal_days: 0,
              worked_days: 18,
            },
            {
              target_id: targetId,
              date: '2025',
              due_minutes: 17600,
              worked_minutes: 17500,
              cumulative_minutes: 0,
              sick_days: 1,
              holidays: 0,
              business_trip: 0,
              child_sick: 0,
              homeoffice: 0,
              normal_days: 0,
              worked_days: 38,
            },
          ],
        },
      });

      expect(pushResponse.statusCode).toBe(200);
      const data = JSON.parse(pushResponse.payload);
      expect(data.saved).toHaveLength(3);

      // Verify all can be pulled back
      const pullResponse = await app.inject({
        method: 'GET',
        url: '/api/balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      const pullData = JSON.parse(pullResponse.payload);
      expect(pullData.balances).toHaveLength(3);
    });

    it('should not return balances for other users', async () => {
      // Create balance for first user
      await app.inject({
        method: 'POST',
        url: '/api/balances/sync',
        headers: { cookie: sessionCookie },
        payload: {
          balances: [{
            target_id: targetId,
            date: '2025-06',
            due_minutes: 9600,
            worked_minutes: 9000,
            cumulative_minutes: -600,
            sick_days: 0,
            holidays: 0,
            business_trip: 0,
            child_sick: 0,
            homeoffice: 0,
            normal_days: 0,
            worked_days: 20,
          }],
        },
      });

      // Register second user
      const result2 = await registerAndAuthenticate(app, {
        email: 'balance2@test.com',
        name: 'Balance Test 2',
      });

      // Second user pulls — should not see first user's balances
      const pullResponse = await app.inject({
        method: 'GET',
        url: '/api/balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: result2.authCookie },
      });

      expect(pullResponse.statusCode).toBe(200);
      const pullData = JSON.parse(pullResponse.payload);
      expect(pullData.balances).toHaveLength(0);
    });
  });
});
