import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { AuthService } from '../services/auth.service.js';

const authService = new AuthService();

export async function authRoutes(fastify: FastifyInstance) {
  // Register endpoint
  fastify.post('/register', {
    schema: {
      tags: ['Authentication'],
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        password: Type.String({ minLength: 8 }),
        name: Type.String(),
        country: Type.Optional(Type.String()),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
          country: Type.Optional(Type.String()),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const { email, password, name, country } = request.body as any;
      const user = await authService.register(email, password, name, country);
      
      return reply.code(201).send({
        id: user.id,
        email: user.email,
        name: user.name,
        country: user.country,
      });
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Login endpoint
  fastify.post('/login', {
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
          country: Type.Optional(Type.String()),
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

    request.session.userId = user.id;
    
    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      country: user.country,
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
          country: Type.Optional(Type.String()),
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
      country: user.country,
    });
  });

  // Change password endpoint
  fastify.put('/change-password', {
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
        country: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
          country: Type.Optional(Type.String()),
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
      country: user.country,
    });
  });
}
