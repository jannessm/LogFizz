import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database.js';
import { MonthlyBalanceService } from '../services/monthly-balance.service.js';

describe('Monthly Balance Calculations', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let userId: string;
  let targetId: string;
  let buttonId: string;
  let monthlyBalanceService: MonthlyBalanceService;

  beforeAll(async () => {
    app = await buildApp();
    monthlyBalanceService = new MonthlyBalanceService();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database
    await AppDataSource.getRepository('MonthlyBalance').deleteAll();
    await AppDataSource.getRepository('TimeLog').deleteAll();
    await AppDataSource.getRepository('Button').deleteAll();
    await AppDataSource.getRepository('DailyTarget').deleteAll();
    await AppDataSource.getRepository('User').deleteAll();

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
  });

  describe('Basic Balance Calculation', () => {
    it('should calculate correct worked minutes from time logs', async () => {
      // Create target with starting_from set to beginning of test month
      const targetResponse = await app.inject({
        method: 'POST',
        url: '/api/targets/sync',
        headers: { cookie: sessionCookie },
        payload: {
          targets: [{
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Test Target',
            duration_minutes: [480], // 8 hours
            weekdays: [1], // Monday only
            exclude_holidays: false,
            starting_from: '2025-01-01T00:00:00.000Z',
          }],
        },
      });

      expect(targetResponse.statusCode).toBe(200);
      targetId = '550e8400-e29b-41d4-a716-446655440001';

      // Create button linked to target
      const buttonResponse = await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: '550e8400-e29b-41d4-a716-446655440002',
            name: 'Work Button',
            auto_subtract_breaks: false,
            target_id: targetId,
          }],
        },
      });

      expect(buttonResponse.statusCode).toBe(200);
      buttonId = '550e8400-e29b-41d4-a716-446655440002';

      // Create time logs for Monday Jan 6, 2025 (9:00 - 17:00 = 8 hours)
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: '550e8400-e29b-41d4-a716-446655440003',
              button_id: buttonId,
              start_timestamp: '2025-01-06T09:00:00.000Z',
              end_timestamp: '2025-01-06T17:00:00.000Z',
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      // Manually trigger monthly balance recalculation
      await monthlyBalanceService.recalculateAffectedMonthlyBalances(
        userId,
        [{ start_timestamp: new Date('2025-01-06T09:00:00.000Z'), button_id: buttonId }]
      );

      // Get monthly balance via sync
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/monthly-balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      // Find January 2025 balance
      const janBalance = data.monthlyBalances.find(
        (b: any) => b.year === 2025 && b.month === 1
      );

      expect(janBalance).toBeDefined();
      expect(janBalance.worked_minutes).toBe(480); // 8 hours
    });

    it('should calculate correct due minutes based on weekdays', async () => {
      // Create target for Mon-Fri with 8 hours/day, starting Jan 1 2025
      const targetResponse = await app.inject({
        method: 'POST',
        url: '/api/targets/sync',
        headers: { cookie: sessionCookie },
        payload: {
          targets: [{
            id: '550e8400-e29b-41d4-a716-446655440010',
            name: 'Work Target',
            duration_minutes: [480, 480, 480, 480, 480], // 8 hours each weekday
            weekdays: [1, 2, 3, 4, 5], // Mon-Fri
            exclude_holidays: false,
            starting_from: '2025-01-01T00:00:00.000Z',
          }],
        },
      });

      expect(targetResponse.statusCode).toBe(200);
      targetId = '550e8400-e29b-41d4-a716-446655440010';

      // Create button linked to target
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: '550e8400-e29b-41d4-a716-446655440011',
            name: 'Work Button',
            auto_subtract_breaks: false,
            target_id: targetId,
          }],
        },
      });

      buttonId = '550e8400-e29b-41d4-a716-446655440011';

      // Create minimal time log to trigger balance calculation
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: '550e8400-e29b-41d4-a716-446655440012',
              button_id: buttonId,
              start_timestamp: '2025-01-06T09:00:00.000Z',
              end_timestamp: '2025-01-06T17:00:00.000Z',
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      // Manually trigger monthly balance recalculation
      await monthlyBalanceService.recalculateAffectedMonthlyBalances(
        userId,
        [{ start_timestamp: new Date('2025-01-06T09:00:00.000Z'), button_id: buttonId }]
      );

      // Get monthly balance
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/monthly-balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      const janBalance = data.monthlyBalances.find(
        (b: any) => b.year === 2025 && b.month === 1
      );

      expect(janBalance).toBeDefined();
      // January 2025 has 23 weekdays (excluding weekends)
      // Due = 23 * 480 = 11040 minutes
      expect(janBalance.due_minutes).toBe(11040);
      expect(janBalance.worked_minutes).toBe(480);
      // Balance = worked - due = 480 - 11040 = -10560
      expect(janBalance.balance_minutes).toBe(-10560);
    });
  });

  describe('Cumulative Balance with Previous Months', () => {
    it('should include previous month balance in current month', async () => {
      // Create target starting Dec 2024
      const targetResponse = await app.inject({
        method: 'POST',
        url: '/api/targets/sync',
        headers: { cookie: sessionCookie },
        payload: {
          targets: [{
            id: '550e8400-e29b-41d4-a716-446655440020',
            name: 'Cumulative Target',
            duration_minutes: [480], // 8 hours
            weekdays: [1], // Monday only
            exclude_holidays: false,
            starting_from: '2024-12-01T00:00:00.000Z',
          }],
        },
      });

      expect(targetResponse.statusCode).toBe(200);
      targetId = '550e8400-e29b-41d4-a716-446655440020';

      // Create button
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: '550e8400-e29b-41d4-a716-446655440021',
            name: 'Test Button',
            auto_subtract_breaks: false,
            target_id: targetId,
          }],
        },
      });

      buttonId = '550e8400-e29b-41d4-a716-446655440021';

      // Create time logs for December 2024 - work 10 hours on each Monday (2 extra hours)
      // December 2024 has Mondays: 2, 9, 16, 23, 30 (5 Mondays)
      const decemberMondays = [2, 9, 16, 23, 30];
      const decTimeLogs: any[] = [];
      
      decemberMondays.forEach((day, idx) => {
        decTimeLogs.push({
          id: `550e8400-e29b-41d4-a716-44665544003${idx}`,
          button_id: buttonId,
          start_timestamp: `2024-12-${day.toString().padStart(2, '0')}T08:00:00.000Z`,
          end_timestamp: `2024-12-${day.toString().padStart(2, '0')}T18:00:00.000Z`, // 10 hours
          timezone: 'UTC',
          updated_at: new Date().toISOString(),
        });
      });

      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: { timeLogs: decTimeLogs },
      });

      // Create time logs for January 2025 - work 8 hours on first Monday
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: '550e8400-e29b-41d4-a716-446655440050',
              button_id: buttonId,
              start_timestamp: '2025-01-06T09:00:00.000Z',
              end_timestamp: '2025-01-06T17:00:00.000Z',
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      // Manually trigger monthly balance recalculation
      await monthlyBalanceService.recalculateAffectedMonthlyBalances(
        userId,
        [{ start_timestamp: new Date('2024-12-02T08:00:00.000Z'), button_id: buttonId }]
      );

      // Get monthly balances
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/monthly-balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);

      // Find December 2024 balance
      const decBalance = data.monthlyBalances.find(
        (b: any) => b.year === 2024 && b.month === 12
      );
      
      // Find January 2025 balance
      const janBalance = data.monthlyBalances.find(
        (b: any) => b.year === 2025 && b.month === 1
      );

      expect(decBalance).toBeDefined();
      expect(janBalance).toBeDefined();

      // December: 5 Mondays * 10 hours worked = 3000 minutes
      // December: 5 Mondays * 8 hours due = 2400 minutes
      // December balance = 3000 - 2400 = 600 (positive)
      expect(decBalance.worked_minutes).toBe(3000);
      expect(decBalance.due_minutes).toBe(2400);
      expect(decBalance.balance_minutes).toBe(600);

      // January: worked 480, due for 4 Mondays (6, 13, 20, 27) = 1920
      // January this month balance = 480 - 1920 = -1440
      // But cumulative should include December's +600
      // Total balance = 600 + (-1440) = -840
      expect(janBalance.worked_minutes).toBe(480);
      expect(janBalance.due_minutes).toBe(1920);
      expect(janBalance.balance_minutes).toBe(-840); // Cumulative!
    });
  });

  describe('Starting From Date Handling', () => {
    it('should not count due time before starting_from date', async () => {
      // Create target starting mid-month (Jan 15, 2025)
      const targetResponse = await app.inject({
        method: 'POST',
        url: '/api/targets/sync',
        headers: { cookie: sessionCookie },
        payload: {
          targets: [{
            id: '550e8400-e29b-41d4-a716-446655440060',
            name: 'Mid-Month Target',
            duration_minutes: [480], // 8 hours
            weekdays: [1], // Monday only
            exclude_holidays: false,
            starting_from: '2025-01-15T00:00:00.000Z', // Mid-January
          }],
        },
      });

      expect(targetResponse.statusCode).toBe(200);
      targetId = '550e8400-e29b-41d4-a716-446655440060';

      // Create button
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: '550e8400-e29b-41d4-a716-446655440061',
            name: 'Test Button',
            auto_subtract_breaks: false,
            target_id: targetId,
          }],
        },
      });

      buttonId = '550e8400-e29b-41d4-a716-446655440061';

      // Create time log on Jan 20 (Monday after starting_from)
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: '550e8400-e29b-41d4-a716-446655440062',
              button_id: buttonId,
              start_timestamp: '2025-01-20T09:00:00.000Z',
              end_timestamp: '2025-01-20T17:00:00.000Z',
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      // Manually trigger monthly balance recalculation
      await monthlyBalanceService.recalculateAffectedMonthlyBalances(
        userId,
        [{ start_timestamp: new Date('2025-01-20T09:00:00.000Z'), button_id: buttonId }]
      );

      // Get monthly balance
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/monthly-balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);

      const janBalance = data.monthlyBalances.find(
        (b: any) => b.year === 2025 && b.month === 1
      );

      expect(janBalance).toBeDefined();
      // Only Mondays on or after Jan 15: 20, 27 = 2 Mondays
      // Due = 2 * 480 = 960 minutes
      expect(janBalance.due_minutes).toBe(960);
      expect(janBalance.worked_minutes).toBe(480);
      // Balance = 480 - 960 = -480
      expect(janBalance.balance_minutes).toBe(-480);
    });

    it('should not include previous month balance if before starting_from', async () => {
      // Create target starting in February 2025
      const targetResponse = await app.inject({
        method: 'POST',
        url: '/api/targets/sync',
        headers: { cookie: sessionCookie },
        payload: {
          targets: [{
            id: '550e8400-e29b-41d4-a716-446655440070',
            name: 'Feb Start Target',
            duration_minutes: [480],
            weekdays: [1],
            exclude_holidays: false,
            starting_from: '2025-02-01T00:00:00.000Z',
          }],
        },
      });

      expect(targetResponse.statusCode).toBe(200);
      targetId = '550e8400-e29b-41d4-a716-446655440070';

      // Create button
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: '550e8400-e29b-41d4-a716-446655440071',
            name: 'Test Button',
            auto_subtract_breaks: false,
            target_id: targetId,
          }],
        },
      });

      buttonId = '550e8400-e29b-41d4-a716-446655440071';

      // Create time log in February
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: '550e8400-e29b-41d4-a716-446655440072',
              button_id: buttonId,
              start_timestamp: '2025-02-03T09:00:00.000Z', // Monday Feb 3
              end_timestamp: '2025-02-03T17:00:00.000Z',
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      // Manually trigger monthly balance recalculation
      await monthlyBalanceService.recalculateAffectedMonthlyBalances(
        userId,
        [{ start_timestamp: new Date('2025-02-03T09:00:00.000Z'), button_id: buttonId }]
      );

      // Get monthly balances
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/monthly-balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);

      const febBalance = data.monthlyBalances.find(
        (b: any) => b.year === 2025 && b.month === 2
      );

      expect(febBalance).toBeDefined();
      // February 2025 has Mondays: 3, 10, 17, 24 = 4 Mondays
      // Due = 4 * 480 = 1920 minutes
      expect(febBalance.due_minutes).toBe(1920);
      expect(febBalance.worked_minutes).toBe(480);
      // Balance should NOT include any January balance since starting_from is Feb 1
      // Balance = 480 - 1920 = -1440
      expect(febBalance.balance_minutes).toBe(-1440);
    });
  });

  describe('No Starting From Date', () => {
    it('should not calculate balance for targets without starting_from', async () => {
      // Create target WITHOUT starting_from
      const targetResponse = await app.inject({
        method: 'POST',
        url: '/api/targets/sync',
        headers: { cookie: sessionCookie },
        payload: {
          targets: [{
            id: '550e8400-e29b-41d4-a716-446655440080',
            name: 'No Start Target',
            duration_minutes: [480],
            weekdays: [1],
            exclude_holidays: false,
            // No starting_from set
          }],
        },
      });

      expect(targetResponse.statusCode).toBe(200);
      targetId = '550e8400-e29b-41d4-a716-446655440080';

      // Create button
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: '550e8400-e29b-41d4-a716-446655440081',
            name: 'Test Button',
            auto_subtract_breaks: false,
            target_id: targetId,
          }],
        },
      });

      buttonId = '550e8400-e29b-41d4-a716-446655440081';

      // Create time log
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: '550e8400-e29b-41d4-a716-446655440082',
              button_id: buttonId,
              start_timestamp: '2025-01-06T09:00:00.000Z',
              end_timestamp: '2025-01-06T17:00:00.000Z',
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      // Get monthly balances - should not include this target
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/monthly-balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);

      // Should not find any balance for this target
      const noStartBalance = data.monthlyBalances.find(
        (b: any) => b.target_id === targetId
      );

      expect(noStartBalance).toBeUndefined();
    });
  });

  describe('Break Subtraction', () => {
    it('should subtract breaks when auto_subtract_breaks is enabled', async () => {
      // Create target
      const targetResponse = await app.inject({
        method: 'POST',
        url: '/api/targets/sync',
        headers: { cookie: sessionCookie },
        payload: {
          targets: [{
            id: '550e8400-e29b-41d4-a716-446655440090',
            name: 'Break Test Target',
            duration_minutes: [480],
            weekdays: [1],
            exclude_holidays: false,
            starting_from: '2025-01-01T00:00:00.000Z',
          }],
        },
      });

      expect(targetResponse.statusCode).toBe(200);
      targetId = '550e8400-e29b-41d4-a716-446655440090';

      // Create button WITH auto_subtract_breaks enabled
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: '550e8400-e29b-41d4-a716-446655440091',
            name: 'Break Button',
            auto_subtract_breaks: true, // Enable break subtraction
            target_id: targetId,
          }],
        },
      });

      buttonId = '550e8400-e29b-41d4-a716-446655440091';

      // Create time log for 9 hours (should subtract 45 mins break)
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: '550e8400-e29b-41d4-a716-446655440092',
              button_id: buttonId,
              start_timestamp: '2025-01-06T08:00:00.000Z',
              end_timestamp: '2025-01-06T17:00:00.000Z', // 9 hours total
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      // Manually trigger monthly balance recalculation
      await monthlyBalanceService.recalculateAffectedMonthlyBalances(
        userId,
        [{ start_timestamp: new Date('2025-01-06T08:00:00.000Z'), button_id: buttonId }]
      );

      // Get monthly balance
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/monthly-balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);

      const janBalance = data.monthlyBalances.find(
        (b: any) => b.year === 2025 && b.month === 1 && b.target_id === targetId
      );

      expect(janBalance).toBeDefined();
      // 9 hours (540 mins) - 45 min break = 495 mins
      expect(janBalance.worked_minutes).toBe(495);
    });
  });

  describe('Recalculate Affected Monthly Balances', () => {
    it('should recalculate from earliest affected month through to current month', async () => {
      // Create target starting from January 2025
      const targetResponse = await app.inject({
        method: 'POST',
        url: '/api/targets/sync',
        headers: { cookie: sessionCookie },
        payload: {
          targets: [{
            id: '550e8400-e29b-41d4-a716-446655440100',
            name: 'Cascade Test Target',
            duration_minutes: [480], // 8 hours per Monday
            weekdays: [1], // Monday only
            exclude_holidays: false,
            starting_from: '2025-01-01T00:00:00.000Z',
          }],
        },
      });

      expect(targetResponse.statusCode).toBe(200);
      targetId = '550e8400-e29b-41d4-a716-446655440100';

      // Create button
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: '550e8400-e29b-41d4-a716-446655440101',
            name: 'Test Button',
            auto_subtract_breaks: false,
            target_id: targetId,
          }],
        },
      });

      buttonId = '550e8400-e29b-41d4-a716-446655440101';

      // Create time logs in January (work extra 2 hours on first Monday)
      // January 2025: Mondays are 6, 13, 20, 27
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: '550e8400-e29b-41d4-a716-446655440102',
              button_id: buttonId,
              start_timestamp: '2025-01-06T08:00:00.000Z',
              end_timestamp: '2025-01-06T18:00:00.000Z', // 10 hours
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      // Manually trigger monthly balance recalculation
      await monthlyBalanceService.recalculateAffectedMonthlyBalances(
        userId,
        [{ start_timestamp: new Date('2025-01-06T08:00:00.000Z'), button_id: buttonId }]
      );

      // Get initial balances
      let syncResponse = await app.inject({
        method: 'GET',
        url: '/api/monthly-balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      let data = JSON.parse(syncResponse.payload);
      
      const janBalance = data.monthlyBalances.find(
        (b: any) => b.year === 2025 && b.month === 1 && b.target_id === targetId
      );

      expect(janBalance).toBeDefined();
      // January: 4 Mondays * 480 = 1920 due, 600 worked = -1320 balance
      expect(janBalance.due_minutes).toBe(1920);
      expect(janBalance.worked_minutes).toBe(600);
      expect(janBalance.balance_minutes).toBe(-1320);

      // Now add more work in March (skip February) - work 16 hours on first Monday
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: '550e8400-e29b-41d4-a716-446655440104',
              button_id: buttonId,
              start_timestamp: '2025-03-03T08:00:00.000Z', // First Monday in March
              end_timestamp: '2025-03-04T00:00:00.000Z', // 16 hours
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      // Manually trigger monthly balance recalculation
      await monthlyBalanceService.recalculateAffectedMonthlyBalances(
        userId,
        [{ start_timestamp: new Date('2025-01-06T08:00:00.000Z'), button_id: buttonId }]
      );

      // Get updated balances - should recalculate Jan, Feb, March, and all months through November
      syncResponse = await app.inject({
        method: 'GET',
        url: '/api/monthly-balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      data = JSON.parse(syncResponse.payload);

      // Find all month balances
      const janBalanceUpdated = data.monthlyBalances.find(
        (b: any) => b.year === 2025 && b.month === 1 && b.target_id === targetId
      );
      const febBalance = data.monthlyBalances.find(
        (b: any) => b.year === 2025 && b.month === 2 && b.target_id === targetId
      );
      const marBalance = data.monthlyBalances.find(
        (b: any) => b.year === 2025 && b.month === 3 && b.target_id === targetId
      );
      const aprBalance = data.monthlyBalances.find(
        (b: any) => b.year === 2025 && b.month === 4 && b.target_id === targetId
      );

      // Verify January still has same values but balance carries forward
      expect(janBalanceUpdated.worked_minutes).toBe(600);
      expect(janBalanceUpdated.due_minutes).toBe(1920);
      expect(janBalanceUpdated.balance_minutes).toBe(-1320);

      // Verify February was calculated (no work, but has due time)
      expect(febBalance).toBeDefined();
      // February 2025: Mondays are 3, 10, 17, 24 = 4 Mondays
      expect(febBalance.worked_minutes).toBe(0);
      expect(febBalance.due_minutes).toBe(1920); // 4 * 480
      // February balance = Jan cumulative (-1320) + Feb (0 - 1920) = -3240
      expect(febBalance.balance_minutes).toBe(-3240);

      // Verify March was calculated with new time log
      expect(marBalance).toBeDefined();
      // March 2025: Mondays are 3, 10, 17, 24, 31 = 5 Mondays
      expect(marBalance.worked_minutes).toBe(960); // 16 hours
      expect(marBalance.due_minutes).toBe(2400); // 5 * 480
      // March balance = Feb cumulative (-3240) + March (960 - 2400) = -4680
      expect(marBalance.balance_minutes).toBe(-4680);

      // Verify April was also calculated (demonstrating cascade)
      expect(aprBalance).toBeDefined();
      // April 2025: Mondays are 7, 14, 21, 28 = 4 Mondays
      expect(aprBalance.worked_minutes).toBe(0);
      expect(aprBalance.due_minutes).toBe(1920); // 4 * 480
      // April balance = March cumulative (-4680) + April (0 - 1920) = -6600
      expect(aprBalance.balance_minutes).toBe(-6600);

      // Verify that months up to current month (November) were calculated
      const targetBalances = data.monthlyBalances.filter(
        (b: any) => b.target_id === targetId
      );
      
      // Should have balances for Jan through Nov 2025 (11 months)
      expect(targetBalances.length).toBeGreaterThanOrEqual(11);
      
      // Verify November exists and has cumulative balance from all previous months
      const novBalance = data.monthlyBalances.find(
        (b: any) => b.year === 2025 && b.month === 11 && b.target_id === targetId
      );
      expect(novBalance).toBeDefined();
      // November balance should be negative (accumulated deficit)
      expect(novBalance.balance_minutes).toBeLessThan(0);
    });

    it('should handle empty time logs array gracefully', async () => {
      const result = await monthlyBalanceService.recalculateAffectedMonthlyBalances(
        userId,
        []
      );
      
      expect(result).toEqual([]);
    });

    it('should recalculate only from the earliest month when multiple non-consecutive months affected', async () => {
      // Create target
      const targetResponse = await app.inject({
        method: 'POST',
        url: '/api/targets/sync',
        headers: { cookie: sessionCookie },
        payload: {
          targets: [{
            id: '550e8400-e29b-41d4-a716-446655440110',
            name: 'Multi Month Target',
            duration_minutes: [480],
            weekdays: [1],
            exclude_holidays: false,
            starting_from: '2025-01-01T00:00:00.000Z',
          }],
        },
      });

      targetId = '550e8400-e29b-41d4-a716-446655440110';

      // Create button
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: '550e8400-e29b-41d4-a716-446655440111',
            name: 'Test Button',
            auto_subtract_breaks: false,
            target_id: targetId,
          }],
        },
      });

      // Add time logs in January, March, and May (non-consecutive)
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            // January
            {
              id: '550e8400-e29b-41d4-a716-446655440112',
              button_id: '550e8400-e29b-41d4-a716-446655440111',
              start_timestamp: '2025-01-06T08:00:00.000Z',
              end_timestamp: '2025-01-06T16:00:00.000Z',
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
            // March
            {
              id: '550e8400-e29b-41d4-a716-446655440114',
              button_id: '550e8400-e29b-41d4-a716-446655440111',
              start_timestamp: '2025-03-03T08:00:00.000Z',
              end_timestamp: '2025-03-03T16:00:00.000Z',
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
            // May
            {
              id: '550e8400-e29b-41d4-a716-446655440116',
              button_id: '550e8400-e29b-41d4-a716-446655440111',
              start_timestamp: '2025-05-05T08:00:00.000Z',
              end_timestamp: '2025-05-05T16:00:00.000Z',
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      // Manually trigger monthly balance recalculation
      await monthlyBalanceService.recalculateAffectedMonthlyBalances(
        userId,
        [{ start_timestamp: new Date('2025-01-06T08:00:00.000Z'), button_id: '550e8400-e29b-41d4-a716-446655440111' }]
      );

      // Get balances
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/monthly-balances/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      const data = JSON.parse(syncResponse.payload);
      const targetBalances = data.monthlyBalances.filter(
        (b: any) => b.target_id === targetId
      );

      // Should have February and April even though no time logs for those months
      const febBalance = targetBalances.find((b: any) => b.month === 2);
      const aprBalance = targetBalances.find((b: any) => b.month === 4);

      expect(febBalance).toBeDefined();
      expect(aprBalance).toBeDefined();

      // February should have cumulative balance from January
      expect(febBalance.balance_minutes).not.toBe(febBalance.worked_minutes - febBalance.due_minutes);
      
      // April should have cumulative balance from March
      expect(aprBalance.balance_minutes).not.toBe(aprBalance.worked_minutes - aprBalance.due_minutes);
    });
  });
});
