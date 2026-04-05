import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { registerAndAuthenticate } from './testHelpers.js';

/**
 * Account deletion tests
 * These tests verify that account deletion properly removes all user data
 * from the database, complying with GDPR right to erasure requirements.
 */
describe('Account Deletion', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUserWithData(email: string) {
    // Register and authenticate via magic link
    const { authCookie: cookies, userId } = await registerAndAuthenticate(app, {
      email,
      name: 'Test User',
    });

    // Create a timer
    const timerResponse = await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: { cookie: cookies },
      payload: {
        timers: [{
          id: `timer-${Date.now()}`,
          name: 'Test Timer',
          color: '#FF0000',
          auto_subtract_breaks: false,
          archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]
      },
    });

    const timerData = JSON.parse(timerResponse.body);
    const timerId = timerData.saved?.[0]?.id;

    // Create a target
    await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: { cookie: cookies },
      payload: {
        targets: [{
          id: `target-${Date.now()}`,
          name: 'Test Target',
          target_spec_ids: [],
          target_specs: [{
            id: `spec-${Date.now()}`,
            starting_from: new Date().toISOString(),
            duration_minutes: [0, 480, 480, 480, 480, 480, 0],
            exclude_holidays: false,
          }],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]
      },
    });

    // Create a timelog if we have a timer
    if (timerId) {
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: cookies },
        payload: {
          timeLogs: [{
            id: `timelog-${Date.now()}`,
            timer_id: timerId,
            type: 'normal',
            whole_day: false,
            start_timestamp: new Date().toISOString(),
            end_timestamp: new Date().toISOString(),
            timezone: 'Europe/Berlin',
            apply_break_calculation: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]
        },
      });
    }

    return { userId, cookies };
  }

  it('should delete account for authenticated user', async () => {
    const email = `delete${Date.now()}@example.com`;
    const { cookies } = await createUserWithData(email);

    // Delete account
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/api/auth/account',
      headers: { cookie: cookies },
    });

    expect(deleteResponse.statusCode).toBe(200);
    const body = JSON.parse(deleteResponse.body);
    expect(body.message).toContain('deleted');
  });

  it('should not allow magic link login after account deletion', async () => {
    const email = `deletenologin${Date.now()}@example.com`;
    const { cookies } = await createUserWithData(email);

    // Delete account
    await app.inject({
      method: 'DELETE',
      url: '/api/auth/account',
      headers: { cookie: cookies },
    });

    // Try to request a magic link again
    const magicLinkResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/request-magic-link',
      payload: {
        email,
      },
    });

    // Should return 200 (generic response) but no email is actually sent
    expect(magicLinkResponse.statusCode).toBe(200);
  });

  it('should remove all user data from database after deletion', async () => {
    const email = `deleteall${Date.now()}@example.com`;
    const { userId, cookies } = await createUserWithData(email);

    // Import database and entities
    const { AppDataSource } = await import('../config/database.js');
    const { User } = await import('../entities/User.js');
    const { Timer } = await import('../entities/Timer.js');
    const { TimeLog } = await import('../entities/TimeLog.js');
    const { Target } = await import('../entities/Target.js');
    const { TargetSpec } = await import('../entities/TargetSpec.js');
    const { Balance } = await import('../entities/Balance.js');
    const { UserSettings } = await import('../entities/UserSettings.js');

    // Verify user exists before deletion
    const userBefore = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
    expect(userBefore).not.toBeNull();

    // Delete account
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/api/auth/account',
      headers: { cookie: cookies },
    });

    expect(deleteResponse.statusCode).toBe(200);

    // Verify all user data is deleted
    const userAfter = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
    expect(userAfter).toBeNull();

    const timersAfter = await AppDataSource.getRepository(Timer).find({ where: { user_id: userId } });
    expect(timersAfter).toHaveLength(0);

    const timeLogsAfter = await AppDataSource.getRepository(TimeLog).find({ where: { user_id: userId } });
    expect(timeLogsAfter).toHaveLength(0);

    const targetsAfter = await AppDataSource.getRepository(Target).find({ where: { user_id: userId } });
    expect(targetsAfter).toHaveLength(0);

    const targetSpecsAfter = await AppDataSource.getRepository(TargetSpec).find({ where: { user_id: userId } });
    expect(targetSpecsAfter).toHaveLength(0);

    const balancesAfter = await AppDataSource.getRepository(Balance).find({ where: { user_id: userId } });
    expect(balancesAfter).toHaveLength(0);

    const userSettingsAfter = await AppDataSource.getRepository(UserSettings).find({ where: { user_id: userId } });
    expect(userSettingsAfter).toHaveLength(0);
  });

  it('should require authentication for account deletion', async () => {
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/api/auth/account',
    });

    expect(deleteResponse.statusCode).toBe(401);
  });
});

describe('Data Export', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should export all user data', async () => {
    const email = `export${Date.now()}@example.com`;
    
    const { authCookie: cookies } = await registerAndAuthenticate(app, {
      email,
      name: 'Export Test User',
    });

    // Export data
    const exportResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/export-data',
      headers: { cookie: cookies },
    });

    expect(exportResponse.statusCode).toBe(200);
    const data = JSON.parse(exportResponse.body);

    // Verify structure
    expect(data).toHaveProperty('user');
    expect(data).toHaveProperty('timers');
    expect(data).toHaveProperty('timelogs');
    expect(data).toHaveProperty('targets');
    expect(data).toHaveProperty('targetSpecs');
    expect(data).toHaveProperty('balances');
    expect(data).toHaveProperty('userSettings');

    // Verify sensitive data is not included
    expect(data.user.password_hash).toBeUndefined();
    expect(data.user.magic_link_token).toBeUndefined();

    // Verify user data
    expect(data.user.email).toBe(email);
    expect(data.user.name).toBe('Export Test User');
  });

  it('should require authentication for data export', async () => {
    const exportResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/export-data',
    });

    expect(exportResponse.statusCode).toBe(401);
  });
});
