import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { registerAndAuthenticate } from './testHelpers.js';

describe('Authentication Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Registration', () => {
    it('should register a new user', async () => {
      const email = `test${Date.now()}@example.com`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.email).toBeDefined();
      expect(body.name).toBe('Test User');
      expect(body.password_hash).toBeUndefined();
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

    it('should generate a magic link token on registration', async () => {
      const email = `magictoken${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          name: 'Test User',
        },
      });

      // Verify token exists in database
      const { AppDataSource } = await import('../config/database.js');
      const { User } = await import('../entities/User.js');
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { email } });

      expect(user).toBeDefined();
      expect(user!.magic_link_token).toBeDefined();
      expect(user!.magic_link_token_expires_at).toBeDefined();
    });

    it('should not set session on registration (requires magic link verification)', async () => {
      const email = `nosession${Date.now()}@example.com`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(201);

      // No session cookie should be set (or the session should not have userId)
      const cookies = response.headers['set-cookie'];

      // Try to access /me with whatever cookies we got - should fail
      const meResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: cookies ? { cookie: cookies } : {},
      });

      expect(meResponse.statusCode).toBe(401);
    });
  });

  describe('Magic Link', () => {
    it('should request a magic link for existing user', async () => {
      const email = `magiclink${Date.now()}@example.com`;

      // Register first
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          name: 'Test User',
        },
      });

      // Request magic link
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/request-magic-link',
        payload: { email },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBeDefined();
    });

    it('should accept magic link request for non-existing email without revealing it', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/request-magic-link',
        payload: {
          email: `nonexistent${Date.now()}@example.com`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBeDefined();
    });

    it('should verify magic link and create session', async () => {
      const email = `verifyml${Date.now()}@example.com`;

      // Register
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          name: 'Magic Link User',
        },
      });

      // Get magic link token from DB
      const { AppDataSource } = await import('../config/database.js');
      const { User } = await import('../entities/User.js');
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { email } });
      const token = user!.magic_link_token!;

      // Verify magic link
      const verifyResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-magic-link',
        payload: { token },
      });

      expect(verifyResponse.statusCode).toBe(200);
      const body = JSON.parse(verifyResponse.body);
      expect(body.id).toBeDefined();
      expect(body.email).toBe(email);
      expect(body.name).toBe('Magic Link User');

      // Should have session cookie
      const cookies = verifyResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });

    it('should reject invalid magic link token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-magic-link',
        payload: { token: 'invalid-token-12345' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject expired magic link token', async () => {
      const email = `expiredml${Date.now()}@example.com`;

      // Register
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          name: 'Test User',
        },
      });

      // Get token and expire it
      const { AppDataSource } = await import('../config/database.js');
      const { User } = await import('../entities/User.js');
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { email } });
      const token = user!.magic_link_token!;

      user!.magic_link_token_expires_at = new Date(Date.now() - 1000);
      await userRepo.save(user!);

      // Try to verify expired token
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-magic-link',
        payload: { token },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should clear magic link token after verification', async () => {
      const email = `clearml${Date.now()}@example.com`;

      // Register
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          name: 'Test User',
        },
      });

      // Get token
      const { AppDataSource } = await import('../config/database.js');
      const { User } = await import('../entities/User.js');
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { email } });
      const token = user!.magic_link_token!;

      // Verify
      await app.inject({
        method: 'POST',
        url: '/api/auth/verify-magic-link',
        payload: { token },
      });

      // Token should be cleared
      const updatedUser = await userRepo.findOne({ where: { email } });
      expect(updatedUser!.magic_link_token).toBeNull();
      expect(updatedUser!.magic_link_token_expires_at).toBeNull();

      // Same token should not work again
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-magic-link',
        payload: { token },
      });

      expect(secondResponse.statusCode).toBe(400);
    });

    it('should mark email as verified after magic link verification', async () => {
      const email = `emailverified${Date.now()}@example.com`;

      // Register
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          name: 'Test User',
        },
      });

      // Get token
      const { AppDataSource } = await import('../config/database.js');
      const { User } = await import('../entities/User.js');
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { email } });
      const token = user!.magic_link_token!;

      // Verify
      await app.inject({
        method: 'POST',
        url: '/api/auth/verify-magic-link',
        payload: { token },
      });

      const verifiedUser = await userRepo.findOne({ where: { email } });
      expect(verifiedUser!.email_verified_at).toBeDefined();
      expect(verifiedUser!.email_verified_at).not.toBeNull();
    });
  });

  describe('Session & Auth', () => {
    it('should return 401 for /me without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user on /me', async () => {
      const email = `metest${Date.now()}@example.com`;
      const { authCookie } = await registerAndAuthenticate(app, { email, name: 'Me Test User' });

      const meResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: authCookie },
      });

      expect(meResponse.statusCode).toBe(200);
      const body = JSON.parse(meResponse.body);
      expect(body.id).toBeDefined();
      expect(body.email).toBe(email);
      expect(body.name).toBe('Me Test User');
    });

    it('should logout successfully without a request body', async () => {
      const { authCookie } = await registerAndAuthenticate(app);

      const logoutResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie: authCookie },
      });

      expect(logoutResponse.statusCode).toBe(200);
      const body = JSON.parse(logoutResponse.body);
      expect(body.message).toContain('Logged out');
    });

    it('should accept logout with empty body', async () => {
      const { authCookie } = await registerAndAuthenticate(app);

      const logoutResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie: authCookie },
        payload: {},
      });

      expect(logoutResponse.statusCode).toBe(200);
    });
  });

  describe('Profile Management', () => {
    it('should update profile', async () => {
      const { authCookie } = await registerAndAuthenticate(app, { name: 'Profile Test User' });

      const updateResponse = await app.inject({
        method: 'PUT',
        url: '/api/auth/profile',
        headers: { cookie: authCookie },
        payload: {
          name: 'Updated Profile User',
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      const body = JSON.parse(updateResponse.body);
      expect(body.name).toBe('Updated Profile User');
    });
  });

  describe('Email Change', () => {
    it('should request email change', async () => {
      const { authCookie } = await registerAndAuthenticate(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/request-email-change',
        headers: { cookie: authCookie },
        payload: { newEmail: `newemail${Date.now()}@example.com` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBeDefined();
    });

    it('should require authentication for email change', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/request-email-change',
        payload: { newEmail: 'newemail@example.com' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should verify email change with valid token', async () => {
      const { authCookie, userId } = await registerAndAuthenticate(app);
      const newEmail = `changed${Date.now()}@example.com`;

      // Request email change
      await app.inject({
        method: 'POST',
        url: '/api/auth/request-email-change',
        headers: { cookie: authCookie },
        payload: { newEmail },
      });

      // Get the email change token from DB
      const { AppDataSource } = await import('../config/database.js');
      const { User } = await import('../entities/User.js');
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId } });
      const token = user!.email_change_token!;

      expect(token).toBeDefined();

      // Verify email change
      const verifyResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-email-change',
        headers: { cookie: authCookie },
        payload: { token },
      });

      expect(verifyResponse.statusCode).toBe(200);
      const body = JSON.parse(verifyResponse.body);
      expect(body.email).toBe(newEmail);
    });

    it('should reject email change with invalid token', async () => {
      const { authCookie } = await registerAndAuthenticate(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-email-change',
        headers: { cookie: authCookie },
        payload: { token: 'invalid-token' },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
