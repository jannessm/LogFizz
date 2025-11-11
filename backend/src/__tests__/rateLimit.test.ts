import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Rate Limiting for Authentication Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Enable strict rate limiting for these tests
    process.env.TEST_RATE_LIMIT = 'strict';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    // Clean up the environment variable
    delete process.env.TEST_RATE_LIMIT;
  });

  describe('Login endpoint rate limiting', () => {
    it('should allow requests within rate limit', async () => {
      const email = `ratelimit${Date.now()}@example.com`;
      
      // Register a user first
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          password: 'testpassword123',
          name: 'Test User',
        },
      });

      // Make 5 login attempts (within limit)
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email,
            password: 'testpassword123',
          },
        });

        // All should succeed (or fail with 401 if password is wrong, but not 429)
        expect(response.statusCode).not.toBe(429);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      const email = `ratelimit-exceed${Date.now()}@example.com`;
      
      // Register a user first
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          password: 'testpassword123',
          name: 'Test User',
        },
      });

      // Make more than 5 login attempts (exceeds limit of 5 per minute)
      const responses = [];
      for (let i = 0; i < 7; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email,
            password: 'testpassword123',
          },
        });
        responses.push(response);
      }

      // At least one of the last requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should include rate limit headers', async () => {
      const email = `ratelimit-headers${Date.now()}@example.com`;
      
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

      // Check for rate limit headers
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Register endpoint rate limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Make 5 registration attempts (within limit)
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/register',
          payload: {
            email: `ratelimit-reg-${Date.now()}-${i}@example.com`,
            password: 'testpassword123',
            name: 'Test User',
          },
        });

        expect(response.statusCode).not.toBe(429);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      // Make more than 5 registration attempts
      const responses = [];
      for (let i = 0; i < 7; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/register',
          payload: {
            email: `ratelimit-reg-exceed-${Date.now()}-${i}@example.com`,
            password: 'testpassword123',
            name: 'Test User',
          },
        });
        responses.push(response);
      }

      // At least one of the last requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Forgot password endpoint rate limiting', () => {
    it('should allow requests within rate limit', async () => {
      const email = `ratelimit-forgot${Date.now()}@example.com`;
      
      // Make 3 forgot password requests (within limit of 3 per 15 minutes)
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/forgot-password',
          payload: {
            email,
          },
        });

        expect(response.statusCode).toBe(200);
        expect(response.statusCode).not.toBe(429);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      const email = `ratelimit-forgot-exceed${Date.now()}@example.com`;
      
      // Make more than 3 forgot password requests
      const responses = [];
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/forgot-password',
          payload: {
            email,
          },
        });
        responses.push(response);
      }

      // At least one of the last requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should have stricter limits than login endpoint', async () => {
      // This test verifies that forgot-password has limit of 3 per 15 min
      // while login has limit of 5 per min
      const email = `ratelimit-comparison${Date.now()}@example.com`;
      
      const forgotPasswordResponses = [];
      for (let i = 0; i < 4; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/forgot-password',
          payload: { email },
        });
        forgotPasswordResponses.push(response);
      }

      // Should be rate limited after 3 requests
      const rateLimited = forgotPasswordResponses.some(r => r.statusCode === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Reset password endpoint rate limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Make 3 reset password requests (within limit)
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/reset-password',
          payload: {
            token: `fake-token-${i}`,
            newPassword: 'newpassword123',
          },
        });

        // Should fail with 400 (invalid token) but not 429 (rate limited)
        expect(response.statusCode).not.toBe(429);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      // Make more than 3 reset password requests
      const responses = [];
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/reset-password',
          payload: {
            token: `fake-token-exceed-${i}`,
            newPassword: 'newpassword123',
          },
        });
        responses.push(response);
      }

      // At least one of the last requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Change password endpoint rate limiting', () => {
    it('should allow requests within rate limit for authenticated users', async () => {
      const email = `ratelimit-change${Date.now()}@example.com`;
      
      // Register and login
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          password: 'testpassword123',
          name: 'Test User',
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

      const cookies = loginResponse.headers['set-cookie'];

      // Make 10 change password requests (within limit)
      for (let i = 0; i < 10; i++) {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/auth/change-password',
          headers: {
            cookie: Array.isArray(cookies) ? cookies.join('; ') : cookies,
          },
          payload: {
            oldPassword: 'testpassword123',
            newPassword: 'newpassword456',
          },
        });

        // Should not be rate limited (but may fail with 401 after first success)
        expect(response.statusCode).not.toBe(429);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      const email = `ratelimit-change-exceed${Date.now()}@example.com`;
      
      // Register and login
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          password: 'testpassword123',
          name: 'Test User',
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

      const cookies = loginResponse.headers['set-cookie'];

      // Make more than 10 change password requests
      const responses = [];
      for (let i = 0; i < 12; i++) {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/auth/change-password',
          headers: {
            cookie: Array.isArray(cookies) ? cookies.join('; ') : cookies,
          },
          payload: {
            oldPassword: 'testpassword123',
            newPassword: 'newpassword456',
          },
        });
        responses.push(response);
      }

      // At least one of the last requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Rate limit response format', () => {
    it('should return proper error message when rate limited', async () => {
      const email = `ratelimit-message${Date.now()}@example.com`;
      
      // Exceed rate limit
      const responses = [];
      for (let i = 0; i < 7; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email,
            password: 'testpassword123',
          },
        });
        responses.push(response);
      }

      const rateLimitedResponse = responses.find(r => r.statusCode === 429);
      expect(rateLimitedResponse).toBeDefined();
      
      if (rateLimitedResponse) {
        const body = JSON.parse(rateLimitedResponse.body);
        expect(body.error || body.message).toBeDefined();
        expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
      }
    });
  });

  describe('Different endpoints have independent rate limits', () => {
    it('should not affect other endpoints when one is rate limited', async () => {
      const email = `ratelimit-independent${Date.now()}@example.com`;
      
      // Register user first
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          password: 'testpassword123',
          name: 'Test User',
        },
      });

      // Exhaust login rate limit
      for (let i = 0; i < 7; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email,
            password: 'testpassword123',
          },
        });
      }

      // Try forgot-password endpoint - should still work
      const forgotResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: {
          email,
        },
      });

      // Should not be rate limited (login and forgot-password have independent limits)
      expect(forgotResponse.statusCode).toBe(200);
    });
  });
});
