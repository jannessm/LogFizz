import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { AuthService } from '../services/auth.service.js';
import { authRateLimit, passwordResetRateLimit, generalAuthRateLimit } from '../config/rateLimit.js';

const authService = new AuthService();

// TypeBox schema for state entry
const StateEntrySchema = Type.Object({
  id: Type.Optional(Type.String()),
  state_id: Type.String(),
  registered_at: Type.String({ format: 'date-time' }),
});

const StateEntryResponseSchema = Type.Object({
  id: Type.String(),
  state_id: Type.String(),
  registered_at: Type.String(),
  created_at: Type.String(),
  updated_at: Type.String(),
  state: Type.Optional(Type.Object({
    id: Type.String(),
    country: Type.String(),
    state: Type.String(),
    code: Type.String(),
  })),
});

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
        state_entries: Type.Optional(Type.Array(StateEntrySchema)),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
          state_entries: Type.Array(StateEntryResponseSchema),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const { email, password, name, state_entries } = request.body as any;
      const user = await authService.register(email, password, name, state_entries);

      // Fetch user with state entries populated
      const userWithEntries = await authService.getUserWithStateEntries(user.id);

      return reply.code(201).send({
        id: userWithEntries!.id,
        email: userWithEntries!.email,
        name: userWithEntries!.name,
        state_entries: userWithEntries!.state_entries || [],
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
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
          state_entries: Type.Array(StateEntryResponseSchema),
          email_verified_at: Type.Optional(Type.String()),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as any;
    const user = await authService.login(email, password);

    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
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
    
    // Fetch user with state entries
    const userWithEntries = await authService.getUserWithStateEntries(user.id);
    
    return reply.send({
      id: userWithEntries!.id,
      email: userWithEntries!.email,
      name: userWithEntries!.name,
      state_entries: userWithEntries!.state_entries || [],
      email_verified_at: userWithEntries!.email_verified_at || null,
    });
  });

  // Logout endpoint
  fastify.post('/logout', async (request, reply) => {
    request.session.destroy((err) => {
      if (err) {
        return reply.code(500).send({ error: 'Failed to logout' });
      }
      return reply.send({ message: 'Logged out successfully' });
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
          state_entries: Type.Array(StateEntryResponseSchema),
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
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    const user = await authService.getUserWithStateEntries(userId);
    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      state_entries: user.state_entries || [],
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
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    const { oldPassword, newPassword } = request.body as any;
    const success = await authService.changePassword(userId, oldPassword, newPassword);

    if (!success) {
      return reply.code(401).send({ error: 'Invalid old password' });
    }

    return reply.send({ message: 'Password changed successfully' });
  });

  // Update user profile endpoint
  fastify.put('/profile', {
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        name: Type.Optional(Type.String()),
        email: Type.Optional(Type.String({ format: 'email' })),
        state_entries: Type.Optional(Type.Array(StateEntrySchema)),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
          state_entries: Type.Array(StateEntryResponseSchema),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    
    if (!userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    const { state_entries, ...userUpdates } = request.body as any;
    const user = await authService.updateUser(userId, userUpdates, state_entries);

    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }

    // Fetch updated user with state entries
    const userWithEntries = await authService.getUserWithStateEntries(userId);

    return reply.send({
      id: userWithEntries!.id,
      email: userWithEntries!.email,
      name: userWithEntries!.name,
      state_entries: userWithEntries!.state_entries || [],
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
      message: 'If an account with that email exists, a password reset link has been sent.' 
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
    const { token, newPassword } = request.body as any;
    const success = await authService.resetPassword(token, newPassword);

    if (!success) {
      return reply.code(400).send({ 
        error: 'Invalid or expired reset token' 
      });
    }

    return reply.send({ 
      message: 'Password has been reset successfully' 
    });
  });

  // Verify email endpoint (no authentication required)
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
      },
    },
  }, async (request, reply) => {
    const { token } = request.body as any;
    const success = await authService.verifyEmail(token);

    if (!success) {
      return reply.code(400).send({ 
        error: 'Invalid or expired verification token' 
      });
    }

    return reply.send({ 
      message: 'Email has been verified successfully' 
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
      message: 'If an account with that email exists and is not verified, a verification link has been sent.' 
    });
  });
}
