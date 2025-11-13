import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { AuthService } from '../services/auth.service.js';
import { authRateLimit, passwordResetRateLimit, generalAuthRateLimit } from '../config/rateLimit.js';

const authService = new AuthService();

export async function authRoutes(fastify: FastifyInstance) {
  // Register endpoint
  fastify.post('/register', {
    ...authRateLimit,
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        name: Type.String(),
        state: Type.Optional(Type.String()),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
          state: Type.Optional(Type.String()),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const { email, name, state } = request.body as any;
      const user = await authService.register(email, name, state);
      
      return reply.code(201).send({
        id: user.id,
        email: user.email,
        name: user.name,
        state: user.state,
      });
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Request login code endpoint
  fastify.post('/request-login-code', {
    ...authRateLimit,
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
    await authService.requestLoginCode(email);
    
    // Always return success to not reveal if user exists
    return reply.code(200).send({
      message: 'If an account exists with this email, a login code has been sent.',
    });
  });

  // Verify login code endpoint
  fastify.post('/verify-login-code', {
    ...authRateLimit,
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        code: Type.String({ minLength: 6, maxLength: 6 }),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
          state: Type.Optional(Type.String()),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { email, code } = request.body as any;
    const user = await authService.verifyLoginCode(email, code);

    if (!user) {
      return reply.code(401).send({ error: 'Invalid or expired code' });
    }

    request.session.userId = user.id;
    
    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      state: user.state,
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
          state: Type.Optional(Type.String()),
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

    const user = await authService.getUserById(userId);
    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      state: user.state,
    });
  });

  // Update user profile endpoint
  fastify.put('/profile', {
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        name: Type.Optional(Type.String()),
        email: Type.Optional(Type.String({ format: 'email' })),
        state: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
          state: Type.Optional(Type.String()),
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

    const updates = request.body as any;
    const user = await authService.updateUser(userId, updates);

    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      state: user.state,
    });
  });

}
