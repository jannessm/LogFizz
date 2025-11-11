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

  // Sync endpoint - Get buttons changed since timestamp
  fastify.get('/sync', {
    schema: {
      tags: ['Buttons'],
      querystring: Type.Object({
        since: Type.String({ format: 'date-time' }),
      }),
      response: {
        200: Type.Object({
          buttons: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            emoji: Type.Optional(Type.String()),
            color: Type.Optional(Type.String()),
            position: Type.Number(),
            icon: Type.Optional(Type.String()),
            goal_time_minutes: Type.Optional(Type.Number()),
            goal_days: Type.Optional(Type.Array(Type.Number())),
            auto_subtract_breaks: Type.Boolean(),
            created_at: Type.String(),
            updated_at: Type.String(),
            deleted_at: Type.Optional(Type.String()),
          })),
          cursor: Type.String(),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { since } = request.query as any;

    try {
      const sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return reply.code(400).send({ error: 'Invalid timestamp format' });
      }

      const buttons = await buttonService.getChangedButtonsSince(userId, sinceDate);
      
      // Cursor represents the current server state - all changes up to this moment have been returned
      // Next sync should request changes after this timestamp
      const cursor = new Date().toISOString();
      
      return reply.send({
        buttons,
        cursor,
      });
    } catch (error) {
      return reply.code(400).send({ error: 'Invalid timestamp' });
    }
  });

  // Sync endpoint - Push button changes
  fastify.post('/sync', {
    schema: {
      tags: ['Buttons'],
      body: Type.Object({
        buttons: Type.Array(Type.Object({
          id: Type.String(), // Required for offline-first with client-generated UUIDs
          name: Type.String(),
          emoji: Type.Optional(Type.String()),
          color: Type.Optional(Type.String()),
          position: Type.Optional(Type.Number()),
          icon: Type.Optional(Type.String()),
          goal_time_minutes: Type.Optional(Type.Number()),
          goal_days: Type.Optional(Type.Array(Type.Number())),
          auto_subtract_breaks: Type.Optional(Type.Boolean()),
          updated_at: Type.Optional(Type.String()),
          deleted_at: Type.Optional(Type.String()),
        })),
      }),
      response: {
        200: Type.Object({
          saved: Type.Optional(Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            emoji: Type.Optional(Type.String()),
            color: Type.Optional(Type.String()),
            position: Type.Number(),
            icon: Type.Optional(Type.String()),
            goal_time_minutes: Type.Optional(Type.Number()),
            goal_days: Type.Optional(Type.Array(Type.Number())),
            auto_subtract_breaks: Type.Boolean(),
            created_at: Type.String(),
            updated_at: Type.String(),
            deleted_at: Type.Optional(Type.String()),
          }))),
          conflicts: Type.Optional(Type.Array(Type.Object({
            id: Type.String(),
            field: Type.Literal('button'),
            clientVersion: Type.Object({
              id: Type.String(),
              name: Type.String(),
              emoji: Type.Optional(Type.String()),
              color: Type.Optional(Type.String()),
              position: Type.Optional(Type.Number()),
              icon: Type.Optional(Type.String()),
              goal_time_minutes: Type.Optional(Type.Number()),
              goal_days: Type.Optional(Type.Array(Type.Number())),
              auto_subtract_breaks: Type.Optional(Type.Boolean()),
              updated_at: Type.Optional(Type.String()),
              deleted_at: Type.Optional(Type.String()),
            }),
            serverVersion: Type.Object({
              id: Type.String(),
              name: Type.String(),
              emoji: Type.Optional(Type.String()),
              color: Type.Optional(Type.String()),
              position: Type.Number(),
              icon: Type.Optional(Type.String()),
              goal_time_minutes: Type.Optional(Type.Number()),
              goal_days: Type.Optional(Type.Array(Type.Number())),
              auto_subtract_breaks: Type.Boolean(),
              created_at: Type.String(),
              updated_at: Type.String(),
              deleted_at: Type.Optional(Type.String()),
            }),
          }))),
          cursor: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { buttons } = request.body as any;

    // Convert timestamp strings to Date objects
    const processedButtons = buttons.map((btn: any) => ({
      ...btn,
      updated_at: btn.updated_at ? new Date(btn.updated_at) : undefined,
      deleted_at: btn.deleted_at ? new Date(btn.deleted_at) : undefined,
    }));

    const result = await buttonService.pushButtonChanges(userId, processedButtons);
    
    // Cursor represents the current server state after this operation
    const cursor = new Date().toISOString();
    
    // If conflicts exist, only return conflicts (client needs to resolve)
    // Otherwise return saved buttons
    const response: any = {
      cursor,
    };

    if (result.conflicts.length > 0) {
      response.conflicts = result.conflicts.map(c => ({
        ...c,
        clientVersion: {
          ...c.clientVersion,
          updated_at: c.clientVersion.updated_at?.toISOString(),
          deleted_at: c.clientVersion.deleted_at?.toISOString(),
        },
        serverVersion: {
          ...c.serverVersion,
          created_at: c.serverVersion.created_at.toISOString(),
          updated_at: c.serverVersion.updated_at.toISOString(),
          deleted_at: c.serverVersion.deleted_at?.toISOString(),
        },
      }));
    }
    
    if (result.saved.length > 0) {
      response.saved = result.saved;
    }

    return reply.send(response);
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

