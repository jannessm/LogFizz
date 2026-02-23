import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Timer Sync Routes', () => {
  let app: FastifyInstance;
  let authCookie: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildApp();

    // Register and login a test user
    const email = `timertest${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'testpassword123',
        name: 'Timer Test User',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email,
        password: 'testpassword123',
      },
    });

    authCookie = loginResponse.headers['set-cookie'] as string;
    userId = JSON.parse(loginResponse.body).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a new timer via sync', async () => {
    const timerId = '550e8400-e29b-41d4-a716-446655440000';
    const response = await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timers: [{
          id: timerId,
          name: 'Work',
          emoji: '💼',
          color: '#3B82F6',
          auto_subtract_breaks: true,
          archived: false,
        }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].id).toBe(timerId);
    expect(body.saved[0].name).toBe('Work');
    expect(body.saved[0].emoji).toBe('💼');
    expect(body.saved[0].color).toBe('#3B82F6');
    expect(body.saved[0].auto_subtract_breaks).toBe(true);
    expect(body.saved[0].archived).toBe(false);
  });

  it('should get all user timers via sync', async () => {
    // Create a timer first
    const timerId = '660e8400-e29b-41d4-a716-446655440001';
    await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timers: [{
          id: timerId,
          name: 'Study',
          emoji: '📚',
          color: '#10B981',
          auto_subtract_breaks: false,
          archived: false,
        }],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/timers/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.timers)).toBe(true);
    expect(body.timers.length).toBeGreaterThan(0);
    expect(body.cursor).toBeDefined();
  });

  it('should update a timer via sync', async () => {
    // Create a timer
    const timerId = '770e8400-e29b-41d4-a716-446655440002';
    await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timers: [{
          id: timerId,
          name: 'Exercise',
          auto_subtract_breaks: false,
        }],
      },
    });

    // Update the timer
    const updateResponse = await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timers: [{
          id: timerId,
          name: 'Workout',
          emoji: '💪',
          auto_subtract_breaks: false,
        }],
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const body = JSON.parse(updateResponse.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].name).toBe('Workout');
    expect(body.saved[0].emoji).toBe('💪');
  });

  it('should soft delete a timer via sync', async () => {
    // Create a timer
    const timerId = '880e8400-e29b-41d4-a716-446655440003';
    await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timers: [{
          id: timerId,
          name: 'Temporary',
          auto_subtract_breaks: false,
        }],
      },
    });

    // Soft delete the timer
    const deleteResponse = await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timers: [{
          id: timerId,
          name: 'Temporary',
          auto_subtract_breaks: false,
          deleted_at: new Date().toISOString(),
        }],
      },
    });

    expect(deleteResponse.statusCode).toBe(200);
    const body = JSON.parse(deleteResponse.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].deleted_at).toBeDefined();

    // Verify it's marked as deleted in sync
    const syncResponse = await app.inject({
      method: 'GET',
      url: '/api/timers/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });

    const syncBody = JSON.parse(syncResponse.body);
    const deletedTimer = syncBody.timers.find((t: any) => t.id === timerId);
    expect(deletedTimer).toBeDefined();
    expect(deletedTimer.deleted_at).toBeDefined();
  });

  it('should archive and unarchive a timer via sync', async () => {
    // Create a timer
    const timerId = '990e8400-e29b-41d4-a716-446655440004';
    await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timers: [{
          id: timerId,
          name: 'Old Project',
          emoji: '📦',
          auto_subtract_breaks: false,
          archived: false,
        }],
      },
    });

    // Archive the timer
    const archiveResponse = await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timers: [{
          id: timerId,
          name: 'Old Project',
          emoji: '📦',
          auto_subtract_breaks: false,
          archived: true,
        }],
      },
    });

    expect(archiveResponse.statusCode).toBe(200);
    const archiveBody = JSON.parse(archiveResponse.body);
    expect(archiveBody.saved).toHaveLength(1);
    expect(archiveBody.saved[0].archived).toBe(true);

    // Unarchive the timer
    const unarchiveResponse = await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timers: [{
          id: timerId,
          name: 'Old Project',
          emoji: '📦',
          auto_subtract_breaks: false,
          archived: false,
        }],
      },
    });

    expect(unarchiveResponse.statusCode).toBe(200);
    const unarchiveBody = JSON.parse(unarchiveResponse.body);
    expect(unarchiveBody.saved).toHaveLength(1);
    expect(unarchiveBody.saved[0].archived).toBe(false);
  });

  it('should create a timer with archived flag set to true', async () => {
    const timerId = 'aa0e8400-e29b-41d4-a716-446655440005';
    const response = await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timers: [{
          id: timerId,
          name: 'Archived Timer',
          archived: true,
          auto_subtract_breaks: false,
        }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].archived).toBe(true);
    expect(body.saved[0].name).toBe('Archived Timer');
  });

  it('should not allow unauthenticated requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/timers/sync?since=1970-01-01T00:00:00.000Z',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should remove target assignment when target_id is set to null', async () => {
    // Create a target first
    const targetId = 'bb0e8400-e29b-41d4-a716-446655440010';
    await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: { cookie: authCookie },
      payload: {
        targets: [{
          id: targetId,
          name: 'Test Target',
          target_specs: [],
        }],
      },
    });

    // Create a timer with a target assigned
    const timerId = 'bb0e8400-e29b-41d4-a716-446655440011';
    await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: { cookie: authCookie },
      payload: {
        timers: [{
          id: timerId,
          name: 'Timer With Target',
          auto_subtract_breaks: false,
          target_id: targetId,
        }],
      },
    });

    // Now remove the target assignment by setting target_id to null
    const updateResponse = await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: { cookie: authCookie },
      payload: {
        timers: [{
          id: timerId,
          name: 'Timer With Target',
          auto_subtract_breaks: false,
          target_id: null,
        }],
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const body = JSON.parse(updateResponse.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].target_id).toBeNull(); // Assignment should be removed
  });

  it('should handle empty string target_id by converting to null/undefined', async () => {
    const timerId = '990e8400-e29b-41d4-a716-446655440099';
    const response = await app.inject({
      method: 'POST',
      url: '/api/timers/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timers: [{
          id: timerId,
          name: 'Timer with Empty Target ID',
          emoji: '⏱️',
          color: '#3B82F6',
          target_id: '', // Empty string should be converted to null/undefined
          auto_subtract_breaks: false,
          archived: false,
        }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].id).toBe(timerId);
    expect(body.saved[0].target_id).toBeNull(); // Should be null, not empty string
  });
});
