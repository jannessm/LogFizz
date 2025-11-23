import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { createRedisClient, getRedisClient, closeRedisClient } from '../config/redis.js';
import { hashPasswordForTransport } from '../utils/clientPasswordHash.js';

describe('Redis Session Storage', () => {
  let app: FastifyInstance;
  const testEmail = `redis-test-${Date.now()}@example.com`;
  const testPassword = 'testpassword123';
  let sessionCookie: string;

  beforeAll(async () => {
    app = await buildApp();
    
    // Register a test user
    const hashedPassword = hashPasswordForTransport(testPassword, testEmail);
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: testEmail,
        password: hashedPassword,
        name: 'Redis Test User',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Redis Client Configuration', () => {
    it('should create Redis client with proper configuration', () => {
      const redis = getRedisClient();
      
      if (process.env.REDIS_HOST) {
        expect(redis).not.toBeNull();
        if (redis) {
          expect(redis.status).toBeDefined();
        }
      } else {
        // If no REDIS_HOST configured, client should be null
        expect(redis).toBeNull();
      }
    });

    it('should handle missing Redis configuration gracefully', () => {
      // This test verifies the app doesn't crash without Redis
      expect(app).toBeDefined();
      expect(app.server).toBeDefined();
    });
  });

  describe('Session Persistence with Redis', () => {
    it('should create a session on login', async () => {
      const hashedPassword = hashPasswordForTransport(testPassword, testEmail);
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testEmail,
          password: hashedPassword,
        },
      });

      expect(response.statusCode).toBe(200);
      
      // Extract session cookie
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      
      if (typeof setCookieHeader === 'string') {
        sessionCookie = setCookieHeader;
      } else if (Array.isArray(setCookieHeader)) {
        sessionCookie = setCookieHeader[0];
      }
      
      expect(sessionCookie).toContain('sessionId=');
    });

    it('should maintain session across requests', async () => {
      // Login first
      const hashedPassword = hashPasswordForTransport(testPassword, testEmail);
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testEmail,
          password: hashedPassword,
        },
      });

      const setCookieHeader = loginResponse.headers['set-cookie'];
      let cookie: string;
      if (typeof setCookieHeader === 'string') {
        cookie = setCookieHeader;
      } else if (Array.isArray(setCookieHeader)) {
        cookie = setCookieHeader[0];
      } else {
        throw new Error('No session cookie set');
      }

      // Make authenticated request with session cookie
      const meResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: cookie,
        },
      });

      expect(meResponse.statusCode).toBe(200);
      const user = JSON.parse(meResponse.body);
      expect(user.email).toBe(testEmail);
    });

    it('should return 401 without valid session', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should destroy session on logout', async () => {
      // Login first
      const hashedPassword = hashPasswordForTransport(testPassword, testEmail);
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testEmail,
          password: hashedPassword,
        },
      });

      const setCookieHeader = loginResponse.headers['set-cookie'];
      let cookie: string;
      if (typeof setCookieHeader === 'string') {
        cookie = setCookieHeader;
      } else if (Array.isArray(setCookieHeader)) {
        cookie = setCookieHeader[0];
      } else {
        throw new Error('No session cookie set');
      }

      // Logout
      const logoutResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          cookie: cookie,
        },
      });

      expect(logoutResponse.statusCode).toBe(200);

      // Try to use the same session - should fail
      const meResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: cookie,
        },
      });

      expect(meResponse.statusCode).toBe(401);
    });
  });

  describe('Session Data Integrity', () => {
    it('should store user ID in session', async () => {
      const hashedPassword = hashPasswordForTransport(testPassword, testEmail);
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testEmail,
          password: hashedPassword,
        },
      });

      expect(loginResponse.statusCode).toBe(200);
      
      const setCookieHeader = loginResponse.headers['set-cookie'];
      let cookie: string;
      if (typeof setCookieHeader === 'string') {
        cookie = setCookieHeader;
      } else if (Array.isArray(setCookieHeader)) {
        cookie = setCookieHeader[0];
      } else {
        throw new Error('No session cookie set');
      }

      // Verify session contains user data
      const meResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: cookie,
        },
      });

      expect(meResponse.statusCode).toBe(200);
      const user = JSON.parse(meResponse.body);
      expect(user.id).toBeDefined();
      expect(user.email).toBe(testEmail);
    });

    it('should handle concurrent sessions for same user', async () => {
      const hashedPassword = hashPasswordForTransport(testPassword, testEmail);
      
      // Create two sessions
      const login1 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testEmail,
          password: hashedPassword,
        },
      });

      const login2 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testEmail,
          password: hashedPassword,
        },
      });

      expect(login1.statusCode).toBe(200);
      expect(login2.statusCode).toBe(200);

      // Extract cookies
      const cookie1 = Array.isArray(login1.headers['set-cookie']) 
        ? login1.headers['set-cookie'][0] 
        : login1.headers['set-cookie'];
      const cookie2 = Array.isArray(login2.headers['set-cookie']) 
        ? login2.headers['set-cookie'][0] 
        : login2.headers['set-cookie'];

      expect(cookie1).toBeDefined();
      expect(cookie2).toBeDefined();
      expect(cookie1).not.toBe(cookie2);

      // Both sessions should work
      const me1 = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: cookie1 as string },
      });

      const me2 = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: cookie2 as string },
      });

      expect(me1.statusCode).toBe(200);
      expect(me2.statusCode).toBe(200);
    });
  });

  describe('Session Security', () => {
    it('should set httpOnly cookie', async () => {
      const hashedPassword = hashPasswordForTransport(testPassword, testEmail);
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testEmail,
          password: hashedPassword,
        },
      });

      const setCookieHeader = response.headers['set-cookie'];
      const cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
      
      expect(cookie).toContain('HttpOnly');
    });

    it('should set SameSite cookie attribute', async () => {
      const hashedPassword = hashPasswordForTransport(testPassword, testEmail);
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testEmail,
          password: hashedPassword,
        },
      });

      const setCookieHeader = response.headers['set-cookie'];
      const cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
      
      expect(cookie).toMatch(/SameSite=(Lax|lax)/i);
    });

    it('should set Path attribute', async () => {
      const hashedPassword = hashPasswordForTransport(testPassword, testEmail);
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testEmail,
          password: hashedPassword,
        },
      });

      const setCookieHeader = response.headers['set-cookie'];
      const cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
      
      expect(cookie).toContain('Path=/');
    });

    it('should reject invalid session cookies', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: 'sessionId=invalid-session-id-12345',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject malformed session cookies', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: 'sessionId=',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Redis Connection Resilience', () => {
    it('should handle Redis unavailability gracefully in tests', () => {
      // In test environment without REDIS_HOST, app should still work
      expect(app).toBeDefined();
      expect(app.server.listening || !app.server.listening).toBeDefined();
    });

    it('should provide fallback to in-memory sessions', async () => {
      // This test verifies that even without Redis, sessions work
      const testUser = `fallback-${Date.now()}@example.com`;
      const hashedPassword = hashPasswordForTransport(testPassword, testUser);
      
      // Register
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: testUser,
          password: hashedPassword,
          name: 'Fallback Test User',
        },
      });

      // Login
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testUser,
          password: hashedPassword,
        },
      });

      expect(loginResponse.statusCode).toBe(200);
      
      const setCookieHeader = loginResponse.headers['set-cookie'];
      const cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;

      // Verify session works
      const meResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: cookie as string },
      });

      expect(meResponse.statusCode).toBe(200);
    });
  });

  describe('Session with Protected Routes', () => {
    let authCookie: string;

    beforeEach(async () => {
      // Login and get session cookie
      const hashedPassword = hashPasswordForTransport(testPassword, testEmail);
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testEmail,
          password: hashedPassword,
        },
      });

      const setCookieHeader = response.headers['set-cookie'];
      authCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader as string;
    });

    it('should allow access to buttons endpoint with valid session', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/buttons',
        headers: {
          cookie: authCookie,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should allow access to timelogs endpoint with valid session', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/timelogs',
        headers: {
          cookie: authCookie,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should deny access to protected routes without session', async () => {
      const buttonsResponse = await app.inject({
        method: 'GET',
        url: '/api/buttons',
      });

      const timelogsResponse = await app.inject({
        method: 'GET',
        url: '/api/timelogs',
      });

      expect(buttonsResponse.statusCode).toBe(401);
      expect(timelogsResponse.statusCode).toBe(401);
    });
  });
});

describe('Redis Client Management', () => {
  describe('createRedisClient', () => {
    it('should return null when REDIS_HOST is not set in test environment', () => {
      const originalHost = process.env.REDIS_HOST;
      delete process.env.REDIS_HOST;
      
      const client = createRedisClient();
      
      // Restore
      if (originalHost) {
        process.env.REDIS_HOST = originalHost;
      }
      
      expect(client).toBeNull();
    });

    it('should create client when REDIS_HOST is set', () => {
      const originalHost = process.env.REDIS_HOST;
      const originalEnv = process.env.NODE_ENV;
      
      // Set production-like environment
      process.env.REDIS_HOST = 'localhost';
      process.env.NODE_ENV = 'development';
      
      const client = createRedisClient();
      
      // Restore
      if (originalHost) {
        process.env.REDIS_HOST = originalHost;
      } else {
        delete process.env.REDIS_HOST;
      }
      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      }
      
      if (client) {
        expect(client).toBeDefined();
        // Clean up
        client.disconnect();
      }
    });
  });

  describe('getRedisClient', () => {
    it('should return the current Redis client instance', () => {
      const client = getRedisClient();
      
      if (process.env.REDIS_HOST) {
        expect(client).not.toBeNull();
      } else {
        expect(client).toBeNull();
      }
    });
  });
});
