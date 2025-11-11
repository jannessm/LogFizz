import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Button Routes', () => {
  let app: FastifyInstance;
  let authCookie: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildApp();

    // Register and login a test user
    const email = `buttontest${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'testpassword123',
        name: 'Button Test User',
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

  it('should create a new button', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/buttons',
      headers: {
        cookie: authCookie,
      },
      payload: {
        name: 'Work',
        emoji: '💼',
        color: '#3B82F6',
        position: 0,
        goal_time_minutes: 480,
        goal_days: [1, 2, 3, 4, 5],
        auto_subtract_breaks: true,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.name).toBe('Work');
    expect(body.emoji).toBe('💼');
    expect(body.goal_time_minutes).toBe(480);
    expect(body.auto_subtract_breaks).toBe(true);
  });

  it('should get all user buttons', async () => {
    // Create a button first
    await app.inject({
      method: 'POST',
      url: '/api/buttons',
      headers: {
        cookie: authCookie,
      },
      payload: {
        name: 'Study',
        emoji: '📚',
        color: '#10B981',
        position: 1,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/buttons',
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('should update a button', async () => {
    // Create a button
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/buttons',
      headers: {
        cookie: authCookie,
      },
      payload: {
        name: 'Exercise',
        position: 2,
      },
    });

    const buttonId = JSON.parse(createResponse.body).id;

    // Update the button
    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/api/buttons/${buttonId}`,
      headers: {
        cookie: authCookie,
      },
      payload: {
        name: 'Workout',
        emoji: '💪',
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const body = JSON.parse(updateResponse.body);
    expect(body.name).toBe('Workout');
    expect(body.emoji).toBe('💪');
  });

  it('should delete a button', async () => {
    // Create a button
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/buttons',
      headers: {
        cookie: authCookie,
      },
      payload: {
        name: 'Temporary',
        position: 3,
      },
    });

    const buttonId = JSON.parse(createResponse.body).id;

    // Delete the button
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/buttons/${buttonId}`,
      headers: {
        cookie: authCookie,
      },
    });

    expect(deleteResponse.statusCode).toBe(200);

    // Verify it's deleted
    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/buttons/${buttonId}`,
      headers: {
        cookie: authCookie,
      },
    });

    expect(getResponse.statusCode).toBe(404);
  });

  it('should not allow unauthenticated requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/buttons',
    });

    expect(response.statusCode).toBe(401);
  });
});
