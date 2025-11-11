import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { AppDataSource } from '../config/database.js';
import { initializeTestDatabase } from './testDatabase.js';
import { FastifyInstance } from 'fastify';

describe('TimeLog Routes', () => {
  let app: FastifyInstance;
  let authCookie: string;
  let buttonId: string;

  beforeAll(async () => {
    // Initialize test database with clean state
    await initializeTestDatabase();
    app = await buildApp();

    // Register and login a test user
    const email = `timelogtest${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'testpassword123',
        name: 'TimeLog Test User',
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

    // Create a button for testing
    const buttonResponse = await app.inject({
      method: 'POST',
      url: '/api/buttons',
      headers: {
        cookie: authCookie,
      },
      payload: {
        name: 'Test Button',
        position: 0,
        auto_subtract_breaks: true,
      },
    });

    buttonId = JSON.parse(buttonResponse.body).id;
  });

  afterAll(async () => {
    await app.close();
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('should start a timer', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/timelogs/start',
      headers: {
        cookie: authCookie,
      },
      payload: {
        button_id: buttonId,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBeDefined();
    expect(body.button_id).toBe(buttonId);
    expect(body.start_time).toBeDefined();
  });

  it('should get active timer', async () => {
    // Start a timer
    const startResponse = await app.inject({
      method: 'POST',
      url: '/api/timelogs/start',
      headers: {
        cookie: authCookie,
      },
      payload: {
        button_id: buttonId,
      },
    });

    const timeLogId = JSON.parse(startResponse.body).id;

    // Get active timer
    const response = await app.inject({
      method: 'GET',
      url: '/api/timelogs/active',
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).not.toBeNull();
    expect(body.id).toBe(timeLogId);
  });

  it('should stop a timer', async () => {
    // Start a timer
    const startResponse = await app.inject({
      method: 'POST',
      url: '/api/timelogs/start',
      headers: {
        cookie: authCookie,
      },
      payload: {
        button_id: buttonId,
      },
    });

    const timeLogId = JSON.parse(startResponse.body).id;

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Stop the timer
    const stopResponse = await app.inject({
      method: 'POST',
      url: `/api/timelogs/stop/${timeLogId}`,
      headers: {
        cookie: authCookie,
      },
    });

    expect(stopResponse.statusCode).toBe(200);
    const body = JSON.parse(stopResponse.body);
    expect(body.end_time).toBeDefined();
    expect(body.duration).toBeGreaterThanOrEqual(0);
  });

  it('should create a manual time log', async () => {
    const startTime = new Date();
    startTime.setHours(9, 0, 0, 0);
    const endTime = new Date();
    endTime.setHours(17, 0, 0, 0);

    const response = await app.inject({
      method: 'POST',
      url: '/api/timelogs/manual',
      headers: {
        cookie: authCookie,
      },
      payload: {
        button_id: buttonId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        notes: 'Manual entry for yesterday',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.is_manual).toBe(true);
    expect(body.duration).toBe(480); // 8 hours
  });

  it('should get today\'s time for a button', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/timelogs/today/${buttonId}`,
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.totalMinutes).toBeDefined();
    expect(typeof body.totalMinutes).toBe('number');
  });

  it('should get time logs with filters', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/timelogs?button_id=${buttonId}`,
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should get goal progress', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/timelogs/goal-progress/${buttonId}`,
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.isGoalDay).toBeDefined();
    expect(body.actualMinutes).toBeDefined();
  });

  it('should update a time log', async () => {
    // Create a manual log
    const startTime = new Date();
    startTime.setHours(10, 0, 0, 0);
    const endTime = new Date();
    endTime.setHours(12, 0, 0, 0);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/timelogs/manual',
      headers: {
        cookie: authCookie,
      },
      payload: {
        button_id: buttonId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      },
    });

    const timeLogId = JSON.parse(createResponse.body).id;

    // Update it
    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/api/timelogs/${timeLogId}`,
      headers: {
        cookie: authCookie,
      },
      payload: {
        notes: 'Updated notes',
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const body = JSON.parse(updateResponse.body);
    expect(body.notes).toBe('Updated notes');
  });

  it('should delete a time log', async () => {
    // Create a manual log
    const startTime = new Date();
    const endTime = new Date();
    endTime.setHours(startTime.getHours() + 1);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/timelogs/manual',
      headers: {
        cookie: authCookie,
      },
      payload: {
        button_id: buttonId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      },
    });

    const timeLogId = JSON.parse(createResponse.body).id;

    // Delete it
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/timelogs/${timeLogId}`,
      headers: {
        cookie: authCookie,
      },
    });

    expect(deleteResponse.statusCode).toBe(200);
  });

  it('should not allow unauthenticated requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/timelogs',
    });

    expect(response.statusCode).toBe(401);
  });
});
