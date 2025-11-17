import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Button Sync Routes', () => {
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

  it('should create a new button via sync', async () => {
    const buttonId = '550e8400-e29b-41d4-a716-446655440000';
    const response = await app.inject({
      method: 'POST',
      url: '/api/buttons/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        buttons: [{
          id: buttonId,
          name: 'Work',
          emoji: '💼',
          color: '#3B82F6',
          auto_subtract_breaks: true,
        }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].id).toBe(buttonId);
    expect(body.saved[0].name).toBe('Work');
    expect(body.saved[0].emoji).toBe('💼');
    expect(body.saved[0].color).toBe('#3B82F6');
    expect(body.saved[0].auto_subtract_breaks).toBe(true);
  });

  it('should get all user buttons via sync', async () => {
    // Create a button first
    const buttonId = '660e8400-e29b-41d4-a716-446655440001';
    await app.inject({
      method: 'POST',
      url: '/api/buttons/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        buttons: [{
          id: buttonId,
          name: 'Study',
          emoji: '📚',
          color: '#10B981',
          auto_subtract_breaks: false,
        }],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/buttons/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.buttons)).toBe(true);
    expect(body.buttons.length).toBeGreaterThan(0);
    expect(body.cursor).toBeDefined();
  });

  it('should update a button via sync', async () => {
    // Create a button
    const buttonId = '770e8400-e29b-41d4-a716-446655440002';
    await app.inject({
      method: 'POST',
      url: '/api/buttons/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        buttons: [{
          id: buttonId,
          name: 'Exercise',
          auto_subtract_breaks: false,
        }],
      },
    });

    // Update the button
    const updateResponse = await app.inject({
      method: 'POST',
      url: '/api/buttons/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        buttons: [{
          id: buttonId,
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

  it('should soft delete a button via sync', async () => {
    // Create a button
    const buttonId = '880e8400-e29b-41d4-a716-446655440003';
    await app.inject({
      method: 'POST',
      url: '/api/buttons/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        buttons: [{
          id: buttonId,
          name: 'Temporary',
          auto_subtract_breaks: false,
        }],
      },
    });

    // Soft delete the button
    const deleteResponse = await app.inject({
      method: 'POST',
      url: '/api/buttons/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        buttons: [{
          id: buttonId,
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
      url: '/api/buttons/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });

    const syncBody = JSON.parse(syncResponse.body);
    const deletedButton = syncBody.buttons.find((b: any) => b.id === buttonId);
    expect(deletedButton).toBeDefined();
    expect(deletedButton.deleted_at).toBeDefined();
  });

  it('should not allow unauthenticated requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/buttons/sync?since=1970-01-01T00:00:00.000Z',
    });

    expect(response.statusCode).toBe(401);
  });
});
