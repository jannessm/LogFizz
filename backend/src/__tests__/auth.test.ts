import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { hashPasswordForTransport } from '../utils/clientPasswordHash.js';

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
    const password = 'testpassword123';
    const hashedPassword = hashPasswordForTransport(password, email);
    
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: hashedPassword,
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
    const password = 'testpassword123';
    const hashedPassword = hashPasswordForTransport(password, email);
    
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: hashedPassword,
        name: 'Test User',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: hashedPassword,
        name: 'Test User',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should login with correct credentials', async () => {
    const email = `login${Date.now()}@example.com`;
    const password = 'testpassword123';
    const hashedPassword = hashPasswordForTransport(password, email);
    
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: hashedPassword,
        name: 'Test User',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email,
        password: hashedPassword,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.email).toBe(email);
    expect(body.name).toBe('Test User');
  });

  it('should not login with incorrect password', async () => {
    const email = `wrongpass${Date.now()}@example.com`;
    const password = 'testpassword123';
    const hashedPassword = hashPasswordForTransport(password, email);
    const wrongHashedPassword = hashPasswordForTransport('wrongpassword', email);
    
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: hashedPassword,
        name: 'Test User',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email,
        password: wrongHashedPassword,
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

  describe('Forgot Password', () => {
    it('should accept forgot password request for existing email', async () => {
      const email = `forgotpass${Date.now()}@example.com`;
      const password = 'testpassword123';
      const hashedPassword = hashPasswordForTransport(password, email);
      
      // Register a user first
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          password: hashedPassword,
          name: 'Test User',
        },
      });

      // Request password reset
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: {
          email,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('password reset link');
    });

    it('should accept forgot password request for non-existing email without revealing it', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: {
          email: `nonexistent${Date.now()}@example.com`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('password reset link');
    });

    it('should reset password with valid token', async () => {
      const email = `resetpass${Date.now()}@example.com`;
      const originalPassword = 'testpassword123';
      const newPassword = 'newpassword456';
      const hashedOriginalPassword = hashPasswordForTransport(originalPassword, email);
      const hashedNewPassword = hashPasswordForTransport(newPassword, email);
      
      // Register a user
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          password: hashedOriginalPassword,
          name: 'Test User',
        },
      });

      // Request password reset
      await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: {
          email,
        },
      });

      // Get the reset token from the database (in a real test, you'd extract it from the email)
      const { AppDataSource } = await import('../config/database.js');
      const { User } = await import('../entities/User.js');
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { email } });
      const resetToken = user?.reset_token;

      expect(resetToken).toBeDefined();

      // Reset password with the token
      const resetResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: {
          token: resetToken,
          newPassword: hashedNewPassword,
        },
      });

      expect(resetResponse.statusCode).toBe(200);
      const body = JSON.parse(resetResponse.body);
      expect(body.message).toContain('reset successfully');

      // Verify old password doesn't work
      const loginWithOldPassword = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email,
          password: hashedOriginalPassword,
        },
      });

      expect(loginWithOldPassword.statusCode).toBe(401);

      // Verify new password works
      const loginWithNewPassword = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email,
          password: hashedNewPassword,
        },
      });

      expect(loginWithNewPassword.statusCode).toBe(200);
    });

    it('should reject password reset with invalid token', async () => {
      const email = 'dummy@example.com';
      const newPassword = 'newpassword456';
      const hashedNewPassword = hashPasswordForTransport(newPassword, email);
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: {
          token: 'invalid-token-12345',
          newPassword: hashedNewPassword,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid or expired');
    });

    it('should reject password reset with expired token', async () => {
      const email = `expiredtoken${Date.now()}@example.com`;
      const password = 'testpassword123';
      const hashedPassword = hashPasswordForTransport(password, email);
      const newPassword = 'newpassword456';
      const hashedNewPassword = hashPasswordForTransport(newPassword, email);
      
      // Register a user
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          password: hashedPassword,
          name: 'Test User',
        },
      });

      // Request password reset
      await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: {
          email,
        },
      });

      // Get the reset token and manually expire it
      const { AppDataSource } = await import('../config/database.js');
      const { User } = await import('../entities/User.js');
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { email } });
      const resetToken = user?.reset_token;

      // Set expiration to past
      if (user) {
        user.reset_token_expires_at = new Date(Date.now() - 1000);
        await userRepository.save(user);
      }

      // Try to reset password with expired token
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: {
          token: resetToken,
          newPassword: hashedNewPassword,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid or expired');
    });

    it('should clear reset token after successful password reset', async () => {
      const email = `cleartoken${Date.now()}@example.com`;
      const password = 'testpassword123';
      const hashedPassword = hashPasswordForTransport(password, email);
      const newPassword = 'newpassword456';
      const hashedNewPassword = hashPasswordForTransport(newPassword, email);
      
      // Register a user
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          password: hashedPassword,
          name: 'Test User',
        },
      });

      // Request password reset
      await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: {
          email,
        },
      });

      // Get the reset token
      const { AppDataSource } = await import('../config/database.js');
      const { User } = await import('../entities/User.js');
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { email } });
      const resetToken = user?.reset_token;

      // Reset password
      await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: {
          token: resetToken,
          newPassword: hashedNewPassword,
        },
      });

      // Verify token is cleared
      const updatedUser = await userRepository.findOne({ where: { email } });
      expect(updatedUser?.reset_token).toBeNull();
      expect(updatedUser?.reset_token_expires_at).toBeNull();

      // Try to use the same token again
      const anotherPassword = 'anotherpassword789';
      const hashedAnotherPassword = hashPasswordForTransport(anotherPassword, email);
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: {
          token: resetToken,
          newPassword: hashedAnotherPassword,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should enforce minimum password length on reset', async () => {
      const email = 'test@example.com';
      const shortPassword = 'short';
      const hashedShortPassword = hashPasswordForTransport(shortPassword, email);
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: {
          token: 'some-token',
          newPassword: hashedShortPassword,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
