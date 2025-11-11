import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Authentication Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should register a new user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `test${Date.now()}@example.com`,
        password: 'testpassword123',
        name: 'Test User',
        state: 'CA',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.email).toBeDefined();
    expect(body.name).toBe('Test User');
    expect(body.state).toBe('CA');
    expect(body.password_hash).toBeUndefined();
  });

  it('should not register a user with duplicate email', async () => {
    const email = `duplicate${Date.now()}@example.com`;
    
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'testpassword123',
        name: 'Test User',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'testpassword123',
        name: 'Test User',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should login with correct credentials', async () => {
    const email = `login${Date.now()}@example.com`;
    
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'testpassword123',
        name: 'Test User',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email,
        password: 'testpassword123',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.email).toBe(email);
    expect(body.name).toBe('Test User');
  });

  it('should not login with incorrect password', async () => {
    const email = `wrongpass${Date.now()}@example.com`;
    
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'testpassword123',
        name: 'Test User',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email,
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 401 for /me without authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(401);
  });
});
