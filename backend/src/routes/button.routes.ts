import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ButtonService } from '../services/button.service.js';

const buttonService = new ButtonService();

export async function buttonRoutes(fastify: FastifyInstance) {
  // Middleware to check authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

  // Get all buttons for the user
  fastify.get('/', {
    schema: {
      tags: ['Buttons'],
      response: {
        200: Type.Array(Type.Object({
          id: Type.String(),
          name: Type.String(),
          emoji: Type.Optional(Type.String()),
          color: Type.Optional(Type.String()),
          position: Type.Number(),
          icon: Type.Optional(Type.String()),
          goal_time_minutes: Type.Optional(Type.Number()),
          goal_days: Type.Optional(Type.Array(Type.Number())),
          auto_subtract_breaks: Type.Boolean(),
        })),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const buttons = await buttonService.getUserButtons(userId);
    return reply.send(buttons);
  });

  // Create a new button
  fastify.post('/', {
    schema: {
      tags: ['Buttons'],
      body: Type.Object({
        name: Type.String(),
        emoji: Type.Optional(Type.String()),
        color: Type.Optional(Type.String()),
        position: Type.Optional(Type.Number()),
        icon: Type.Optional(Type.String()),
        goal_time_minutes: Type.Optional(Type.Number()),
        goal_days: Type.Optional(Type.Array(Type.Number())),
        auto_subtract_breaks: Type.Optional(Type.Boolean()),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          name: Type.String(),
          emoji: Type.Optional(Type.String()),
          color: Type.Optional(Type.String()),
          position: Type.Number(),
          icon: Type.Optional(Type.String()),
          goal_time_minutes: Type.Optional(Type.Number()),
          goal_days: Type.Optional(Type.Array(Type.Number())),
          auto_subtract_breaks: Type.Boolean(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const data = request.body as any;
    const button = await buttonService.createButton(userId, data);
    return reply.code(201).send(button);
  });

  // Update a button
  fastify.put('/:id', {
    schema: {
      tags: ['Buttons'],
      params: Type.Object({
        id: Type.String(),
      }),
      body: Type.Object({
        name: Type.Optional(Type.String()),
        emoji: Type.Optional(Type.String()),
        color: Type.Optional(Type.String()),
        position: Type.Optional(Type.Number()),
        icon: Type.Optional(Type.String()),
        goal_time_minutes: Type.Optional(Type.Number()),
        goal_days: Type.Optional(Type.Array(Type.Number())),
        auto_subtract_breaks: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          name: Type.String(),
          emoji: Type.Optional(Type.String()),
          color: Type.Optional(Type.String()),
          position: Type.Number(),
          icon: Type.Optional(Type.String()),
          goal_time_minutes: Type.Optional(Type.Number()),
          goal_days: Type.Optional(Type.Array(Type.Number())),
          auto_subtract_breaks: Type.Boolean(),
        }),
        404: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { id } = request.params as any;
    const updates = request.body as any;

    const button = await buttonService.updateButton(id, userId, updates);
    if (!button) {
      return reply.code(404).send({ error: 'Button not found' });
    }

    return reply.send(button);
  });

  // Delete a button
  fastify.delete('/:id', {
    schema: {
      tags: ['Buttons'],
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
        404: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { id } = request.params as any;

    const success = await buttonService.deleteButton(id, userId);
    if (!success) {
      return reply.code(404).send({ error: 'Button not found' });
    }

    return reply.send({ message: 'Button deleted successfully' });
  });

  // Get a specific button
  fastify.get('/:id', {
    schema: {
      tags: ['Buttons'],
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          name: Type.String(),
          emoji: Type.Optional(Type.String()),
          color: Type.Optional(Type.String()),
          position: Type.Number(),
          icon: Type.Optional(Type.String()),
          goal_time_minutes: Type.Optional(Type.Number()),
          goal_days: Type.Optional(Type.Array(Type.Number())),
          auto_subtract_breaks: Type.Boolean(),
        }),
        404: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { id } = request.params as any;

    const button = await buttonService.getButtonById(id, userId);
    if (!button) {
      return reply.code(404).send({ error: 'Button not found' });
    }

    return reply.send(button);
  });
}
