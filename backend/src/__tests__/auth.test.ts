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
    const email = `test${Date.now()}@example.com`;
    
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        name: 'Test User',
        state: 'CA',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.email).toBeDefined();
    expect(body.name).toBe('Test User');
    expect(body.state).toBe('CA');
  });

  it('should not register a user with duplicate email', async () => {
    const email = `duplicate${Date.now()}@example.com`;
    
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        name: 'Test User',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        name: 'Test User',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should request login code', async () => {
    const email = `login${Date.now()}@example.com`;
    
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        name: 'Test User',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/request-login-code',
      payload: {
        email,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('login code');
  });

  it('should verify login code successfully', async () => {
    const email = `verifycode${Date.now()}@example.com`;
    
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        name: 'Test User',
      },
    });

    // Request login code
    await app.inject({
      method: 'POST',
      url: '/api/auth/request-login-code',
      payload: {
        email,
      },
    });

    // Get the login code from the database
    const { AppDataSource } = await import('../config/database.js');
    const { User } = await import('../entities/User.js');
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { email } });
    const loginCode = user?.login_code;

    expect(loginCode).toBeDefined();

    // Verify the code
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-login-code',
      payload: {
        email,
        code: loginCode,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.email).toBe(email);
    expect(body.name).toBe('Test User');
  });

  it('should not verify invalid login code', async () => {
    const email = `invalidcode${Date.now()}@example.com`;
    
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        name: 'Test User',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-login-code',
      payload: {
        email,
        code: '999999',
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

  describe('Email Authentication', () => {
    it('should request login code for non-existing email without revealing it', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/request-login-code',
        payload: {
          email: `nonexistent${Date.now()}@example.com`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('login code');
    });

    it('should clear login code after successful verification', async () => {
      const email = `clearcode${Date.now()}@example.com`;
      
      // Register a user
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          name: 'Test User',
        },
      });

      // Request login code
      await app.inject({
        method: 'POST',
        url: '/api/auth/request-login-code',
        payload: {
          email,
        },
      });

      // Get the login code
      const { AppDataSource } = await import('../config/database.js');
      const { User } = await import('../entities/User.js');
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { email } });
      const loginCode = user?.login_code;

      // Verify code
      await app.inject({
        method: 'POST',
        url: '/api/auth/verify-login-code',
        payload: {
          email,
          code: loginCode,
        },
      });

      // Verify code is cleared
      const updatedUser = await userRepository.findOne({ where: { email } });
      expect(updatedUser?.login_code).toBeNull();
      expect(updatedUser?.login_code_expires_at).toBeNull();

      // Try to use the same code again
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-login-code',
        payload: {
          email,
          code: loginCode,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject expired login code', async () => {
      const email = `expiredcode${Date.now()}@example.com`;
      
      // Register a user
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          name: 'Test User',
        },
      });

      // Request login code
      await app.inject({
        method: 'POST',
        url: '/api/auth/request-login-code',
        payload: {
          email,
        },
      });

      // Get the login code and manually expire it
      const { AppDataSource } = await import('../config/database.js');
      const { User } = await import('../entities/User.js');
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { email } });
      const loginCode = user?.login_code;

      // Set expiration to past
      if (user) {
        user.login_code_expires_at = new Date(Date.now() - 1000);
        await userRepository.save(user);
      }

      // Try to verify with expired code
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-login-code',
        payload: {
          email,
          code: loginCode,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid or expired');
    });
  });
});
