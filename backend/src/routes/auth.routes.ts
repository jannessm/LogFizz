import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { AuthService } from '../services/auth.service.js';
import { authRateLimit, passwordResetRateLimit, generalAuthRateLimit } from '../config/rateLimit.js';
import { requireHCaptcha } from '../utils/hcaptcha.js';
import { t } from '../i18n/index.js';

const authService = new AuthService();

export async function authRoutes(fastify: FastifyInstance) {
  // Register endpoint
  fastify.post('/register', {
    ...authRateLimit,
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        password: Type.String({ minLength: 8 }),
        name: Type.String(),
        hcaptchaToken: Type.Optional(Type.String()),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const { email, password, name, hcaptchaToken } = request.body as any;
      
      // Verify hCaptcha if configured
      await requireHCaptcha(hcaptchaToken, request.ip);
      
      const user = await authService.register(email, password, name);

      return reply.code(201).send({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Login endpoint
  fastify.post('/login', {
    ...authRateLimit,
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        password: Type.String(),
        hcaptchaToken: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
          email_verified_at: Type.Optional(Type.String()),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const { email, password, hcaptchaToken } = request.body as any;
      
      // Verify hCaptcha if configured
      await requireHCaptcha(hcaptchaToken, request.ip);
      
      const user = await authService.login(email, password);

      if (!user) {
        return reply.code(401).send({ error: t('auth.invalidCredentials') });
      }

      // Set session data
      request.session.userId = user.id;
      
      // Session is automatically saved by @fastify/session after the response
      // But we can log for debugging
      const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
      if (!isTest) {
        console.log('Session saved successfully');
        console.log('Session ID:', request.session.sessionId);
        console.log('User ID in session:', request.session.userId);
      }
      
      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        email_verified_at: user.email_verified_at || null,
      });
    } catch (error: any) {
      return reply.code(401).send({ error: error.message });
    }
  });

  // Logout endpoint
  fastify.post('/logout', async (request, reply) => {
    return new Promise((resolve, reject) => {
      request.session.destroy((err) => {
        if (err) {
          reply.code(500).send({ error: 'Failed to logout' });
          reject(err);
        } else {
          reply.send({ message: t('auth.loggedOutSuccess') });
          resolve(undefined);
        }
      });
    });
  });

  // Get current user endpoint
  fastify.get('/me', {
    schema: {
      tags: ['Authentication'],
      response: {
        200: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
          email_verified_at: Type.Optional(Type.String()),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    
    if (!userId) {
      return reply.code(401).send({ error: t('common.notAuthenticated') });
    }

    const user = await authService.getUserById(userId);
    if (!user) {
      return reply.code(401).send({ error: t('auth.userNotFound') });
    }

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      email_verified_at: user.email_verified_at || null,
    });
  });

  // Change password endpoint
  fastify.put('/change-password', {
    ...generalAuthRateLimit,
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        oldPassword: Type.String(),
        newPassword: Type.String({ minLength: 8 }),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    
    if (!userId) {
      return reply.code(401).send({ error: t('common.notAuthenticated') });
    }

    const { oldPassword, newPassword } = request.body as any;
    const success = await authService.changePassword(userId, oldPassword, newPassword);

    if (!success) {
      return reply.code(401).send({ error: t('auth.invalidOldPassword') });
    }

    return reply.send({ message: t('auth.passwordChangedSuccess') });
  });

  // Update user profile endpoint
  fastify.put('/profile', {
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        name: Type.Optional(Type.String()),
        email: Type.Optional(Type.String({ format: 'email' })),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    
    if (!userId) {
      return reply.code(401).send({ error: t('common.notAuthenticated') });
    }

    const userUpdates = request.body as any;
    const user = await authService.updateUser(userId, userUpdates);

    if (!user) {
      return reply.code(401).send({ error: t('auth.userNotFound') });
    }

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  });

  // Request password reset endpoint
  fastify.post('/forgot-password', {
    ...passwordResetRateLimit,
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        email: Type.String({ format: 'email' }),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { email } = request.body as any;
    await authService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    return reply.send({ 
      message: t('auth.passwordResetSent')
    });
  });

  // Reset password endpoint
  fastify.post('/reset-password', {
    ...passwordResetRateLimit,
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        token: Type.String(),
        newPassword: Type.String({ minLength: 8 }),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { token, newPassword, email } = request.body as any;
    const success = await authService.resetPassword(token, newPassword, email);

    if (!success) {
      return reply.code(400).send({ 
        error: t('auth.invalidResetToken')
      });
    }

    return reply.send({ 
      message: t('auth.passwordResetSuccess')
    });
  });

  // Verify email endpoint (authentication required)
  fastify.post('/verify-email', {
    ...generalAuthRateLimit,
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        token: Type.String(),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
        403: Type.Object({
          error: Type.String(),
          code: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    
    if (!userId) {
      return reply.code(401).send({ error: t('common.notAuthenticatedLogin') });
    }

    const { token } = request.body as any;
    const result = await authService.verifyEmail(token, userId);

    if (typeof result === 'object' && result.error === 'wrong_user') {
      return reply.code(403).send({ 
        error: t('auth.verificationWrongAccount'),
        code: 'WRONG_USER',
      });
    }

    if (!result) {
      return reply.code(400).send({ 
        error: t('auth.invalidVerificationToken')
      });
    }

    return reply.send({ 
      message: t('auth.emailVerifiedSuccess')
    });
  });

  // Resend verification email endpoint (no authentication required)
  fastify.post('/resend-verification', {
    ...passwordResetRateLimit,
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        email: Type.String({ format: 'email' }),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { email } = request.body as any;
    await authService.resendVerificationEmail(email);

    // Always return success to prevent email enumeration
    return reply.send({ 
      message: t('auth.verificationSent')
    });
  });

  // Delete account endpoint (GDPR right to erasure)
  fastify.delete('/account', {
    ...generalAuthRateLimit,
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        password: Type.String(),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    
    if (!userId) {
      return reply.code(401).send({ error: t('common.notAuthenticated') });
    }

    const { password } = request.body as any;
    const success = await authService.deleteAccount(userId, password);

    if (!success) {
      return reply.code(401).send({ error: t('auth.invalidPassword') });
    }

    // Destroy the session after successful deletion
    return new Promise((resolve, reject) => {
      request.session.destroy((err) => {
        if (err) {
          // Account is already deleted, so we still return success
          console.error('Failed to destroy session after account deletion:', err);
        }
        reply.send({ message: t('auth.accountDeleted') });
        resolve(undefined);
      });
    });
  });

  // Export user data endpoint (GDPR right to data portability)
  fastify.get('/export-data', {
    schema: {
      tags: ['Authentication'],
      response: {
        200: Type.Object({
          user: Type.Any(),
          timers: Type.Array(Type.Any()),
          timelogs: Type.Array(Type.Any()),
          targets: Type.Array(Type.Any()),
          targetSpecs: Type.Array(Type.Any()),
          balances: Type.Array(Type.Any()),
          userSettings: Type.Any(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    
    if (!userId) {
      return reply.code(401).send({ error: t('common.notAuthenticated') });
    }

    const data = await authService.exportUserData(userId);

    if (!data) {
      return reply.code(401).send({ error: t('auth.userNotFound') });
    }

    return reply.send(data);
  });
}
