import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Daily Target Sync Routes', () => {
  let app: FastifyInstance;
  let authCookie: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildApp();

    // Register and login a test user
    const email = `targettest${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'testpassword123',
        name: 'Target Test User',
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

  it('should create a new daily target via sync', async () => {
    const targetId = '550e8400-e29b-41d4-a716-446655440000';
    const response = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Work Hours',
          duration_minutes: [480], // 8 hours
          weekdays: [1, 2, 3, 4, 5], // Monday to Friday
        }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].id).toBe(targetId);
    expect(body.saved[0].name).toBe('Work Hours');
    expect(body.saved[0].duration_minutes).toEqual([480]);
    expect(body.saved[0].weekdays).toEqual([1, 2, 3, 4, 5]);
  });

  it('should get all user targets via sync', async () => {
    // Create a target first
    const targetId = '660e8400-e29b-41d4-a716-446655440001';
    await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Study Time',
          duration_minutes: [120], // 2 hours
          weekdays: [1, 3, 5], // Monday, Wednesday, Friday
        }],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/targets/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.targets)).toBe(true);
    expect(body.targets.length).toBeGreaterThan(0);
    expect(body.cursor).toBeDefined();
  });

  it('should update a target via sync', async () => {
    // Create a target
    const targetId = '770e8400-e29b-41d4-a716-446655440002';
    await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Exercise Time',
          duration_minutes: [60],
          weekdays: [0, 6], // Weekend
        }],
      },
    });

    // Update the target
    const updateResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Workout Time',
          duration_minutes: [60, 90, 90, 90, 90], // Increased to 90 minutes
          weekdays: [1, 3, 5, 0, 6], // Weekdays + Weekend
        }],
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const body = JSON.parse(updateResponse.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].name).toBe('Workout Time');
    expect(body.saved[0].duration_minutes).toEqual([60, 90, 90, 90, 90]);
    expect(body.saved[0].weekdays).toEqual([1, 3, 5, 0, 6]);
  });

  it('should soft delete a target via sync', async () => {
    // Create a target
    const targetId = '880e8400-e29b-41d4-a716-446655440003';
    await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Temporary Target',
          duration_minutes: [30],
          weekdays: [1, 2, 3],
        }],
      },
    });

    // Soft delete the target
    const deleteResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Temporary Target',
          duration_minutes: [30],
          weekdays: [1, 2, 3],
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
      url: '/api/targets/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });

    const syncBody = JSON.parse(syncResponse.body);
    const deletedTarget = syncBody.targets.find((t: any) => t.id === targetId);
    expect(deletedTarget).toBeDefined();
    expect(deletedTarget.deleted_at).toBeDefined();
  });

  it('should not allow unauthenticated requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/targets/sync?since=1970-01-01T00:00:00.000Z',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should handle multiple targets with different weekdays', async () => {
    const target1Id = '990e8400-e29b-41d4-a716-446655440004';
    const target2Id = '990e8400-e29b-41d4-a716-446655440005';

    const response = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [
          {
            id: target1Id,
            name: 'Weekday Work',
            duration_minutes: [480],
            weekdays: [1, 2, 3, 4, 5],
          },
          {
            id: target2Id,
            name: 'Weekend Hobbies',
            duration_minutes: [120],
            weekdays: [0, 6],
          },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.saved).toHaveLength(2);
    
    const weekdayTarget = body.saved.find((t: any) => t.id === target1Id);
    const weekendTarget = body.saved.find((t: any) => t.id === target2Id);
    
    expect(weekdayTarget.weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(weekendTarget.weekdays).toEqual([0, 6]);
  });

  it('should return cursor for incremental sync', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/targets/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.cursor).toBeDefined();
    
    // Cursor should be a valid ISO timestamp
    const cursorDate = new Date(body.cursor);
    expect(cursorDate.getTime()).toBeGreaterThan(0);
  });

  it('should create a target with ending_at date via sync', async () => {
    const targetId = 'aaae8400-e29b-41d4-a716-446655440100';
    const response = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Ending Target',
          duration_minutes: [480],
          weekdays: [1, 2, 3, 4, 5],
          starting_from: '2025-01-01T00:00:00.000Z',
          ending_at: '2025-06-30T00:00:00.000Z',
        }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].id).toBe(targetId);
    expect(body.saved[0].name).toBe('Ending Target');
    expect(body.saved[0].starting_from).toBeDefined();
    expect(body.saved[0].ending_at).toBeDefined();
    
    // Verify ending_at is correctly parsed
    const endingAtDate = new Date(body.saved[0].ending_at);
    expect(endingAtDate.getFullYear()).toBe(2025);
    expect(endingAtDate.getMonth()).toBe(5); // June (0-indexed)
  });

  it('should update a target ending_at date via sync', async () => {
    const targetId = 'bbae8400-e29b-41d4-a716-446655440101';
    
    // Create target first
    await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Update Ending Target',
          duration_minutes: [480],
          weekdays: [1, 2, 3, 4, 5],
          starting_from: '2025-01-01T00:00:00.000Z',
        }],
      },
    });

    // Update with ending_at
    const updateResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Update Ending Target',
          duration_minutes: [480],
          weekdays: [1, 2, 3, 4, 5],
          starting_from: '2025-01-01T00:00:00.000Z',
          ending_at: '2025-12-31T00:00:00.000Z',
        }],
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const body = JSON.parse(updateResponse.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].ending_at).toBeDefined();
    
    // Verify the date is correctly stored
    const endingAtDate = new Date(body.saved[0].ending_at);
    expect(endingAtDate.getFullYear()).toBe(2025);
    expect(endingAtDate.getMonth()).toBe(11); // December (0-indexed)
  });
});
