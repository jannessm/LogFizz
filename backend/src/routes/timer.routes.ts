import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TimerService } from '../services/timer.service.js';
import dayjs from '../../../lib/utils/dayjs.js';

const timerService = new TimerService();

export async function timerRoutes(fastify: FastifyInstance) {
  // Middleware to check authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

  // Sync endpoint - Get timers changed since timestamp
  fastify.get('/sync', {
    schema: {
      tags: ['Timers'],
      querystring: Type.Object({
        since: Type.String({ format: 'date-time' }),
      }),
      response: {
        200: Type.Object({
          timers: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            emoji: Type.Optional(Type.String()),
            color: Type.Optional(Type.String()),
            target_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            auto_subtract_breaks: Type.Boolean(),
            archived: Type.Boolean(),
            created_at: Type.String(),
            updated_at: Type.String(),
            deleted_at: Type.Optional(Type.String()),
          })),
          cursor: Type.String(),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
        500: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { since } = request.query as any;

    try {
      const sinceDate = dayjs(since);
      if (!sinceDate.isValid()) {
        return reply.code(400).send({ error: 'Invalid timestamp format' });
      }

      const timers = await timerService.getChangedTimersSince(userId, sinceDate.toDate());
      
      // Cursor represents the current server state - all changes up to this moment have been returned
      // Next sync should request changes after this timestamp
      const cursor = dayjs().toISOString();
      
      return reply.send({
        timers,
        cursor,
      });
    } catch (error) {
      console.error('Error fetching timers:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Sync endpoint - Push timer changes
  fastify.post('/sync', {
    schema: {
      tags: ['Timers'],
      body: Type.Object({
        timers: Type.Array(Type.Object({
          id: Type.String(), // Required for offline-first with client-generated UUIDs
          name: Type.String(),
          emoji: Type.Optional(Type.String()),
          color: Type.Optional(Type.String()),
          target_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          auto_subtract_breaks: Type.Optional(Type.Boolean()),
          archived: Type.Optional(Type.Boolean()),
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
            target_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            auto_subtract_breaks: Type.Boolean(),
            archived: Type.Boolean(),
            created_at: Type.String(),
            updated_at: Type.String(),
            deleted_at: Type.Optional(Type.String()),
          }))),
          conflicts: Type.Optional(Type.Array(Type.Object({
            clientVersion: Type.Object({
              id: Type.String(),
              name: Type.String(),
              emoji: Type.Optional(Type.String()),
              color: Type.Optional(Type.String()),
              target_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
              auto_subtract_breaks: Type.Optional(Type.Boolean()),
              archived: Type.Optional(Type.Boolean()),
              updated_at: Type.Optional(Type.String()),
              deleted_at: Type.Optional(Type.String()),
            }),
            serverVersion: Type.Object({
              id: Type.String(),
              name: Type.String(),
              emoji: Type.Optional(Type.String()),
              color: Type.Optional(Type.String()),
              target_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
              auto_subtract_breaks: Type.Boolean(),
              archived: Type.Boolean(),
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
    const { timers } = request.body as any;

    // Convert timestamp strings to Date objects
    const processedTimers = timers.map((tmr: any) => ({
      ...tmr,
      updated_at: tmr.updated_at ? dayjs(tmr.updated_at).toDate() : undefined,
      deleted_at: tmr.deleted_at ? dayjs(tmr.deleted_at).toDate() : undefined,
    }));

    const result = await timerService.pushTimerChanges(userId, processedTimers);
    
    // Cursor represents the current server state after this operation
    const cursor = dayjs().toISOString();
    
    // If conflicts exist, only return conflicts (client needs to resolve)
    // Otherwise return saved timers
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
}

