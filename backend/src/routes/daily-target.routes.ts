import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { DailyTargetService } from '../services/daily-target.service.js';
import dayjs from '../utils/dayjs.js';

const targetService = new DailyTargetService();

export async function dailyTargetRoutes(fastify: FastifyInstance) {
  // Middleware to check authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

  // GET /api/targets/sync - Get targets changed since timestamp
  fastify.get('/sync', {
    schema: {
      tags: ['DailyTargets'],
      querystring: Type.Object({
        since: Type.String({ format: 'date-time' }),
      }),
      response: {
        200: Type.Object({
          targets: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            duration_minutes: Type.Array(Type.Number()),
            weekdays: Type.Array(Type.Number()),
            exclude_holidays: Type.Optional(Type.Boolean()),
            state_code: Type.Optional(Type.String()),
            starting_from: Type.Optional(Type.String()),
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
      
      const targets = await targetService.getChangedTargetsSince(userId, sinceDate.toDate());

      const cursor = dayjs().toISOString();

      return reply.send({
        targets,
        cursor
      });
    } catch (error) {
      console.error('Error fetching targets:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/sync/targets/push - Push local changes to server
  fastify.post<{
    Body: {
      targets: Array<{
        id?: string;
        name: string;
        duration_minutes: number[];
        weekdays: number[];
        exclude_holidays?: boolean;
        state_code?: string;
        starting_from?: string;
        updated_at?: string;
        deleted_at?: string;
      }>
    }
  }>('/sync', {
    schema: {
      tags: ['DailyTargets'],
      body: Type.Object({
        targets: Type.Array(Type.Object({
          id: Type.Optional(Type.String()),
          name: Type.String(),
          duration_minutes: Type.Array(Type.Integer()),
          weekdays: Type.Array(Type.Integer()),
          exclude_holidays: Type.Optional(Type.Boolean()),
          state_code: Type.Optional(Type.String()),
          starting_from: Type.Optional(Type.String()),
          updated_at: Type.Optional(Type.String()),
          deleted_at: Type.Optional(Type.String()),
        })),
      }),
      response: {
        200: Type.Object({
          saved: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            duration_minutes: Type.Array(Type.Number()),
            weekdays: Type.Array(Type.Number()),
            exclude_holidays: Type.Optional(Type.Boolean()),
            state_code: Type.Optional(Type.String()),
            starting_from: Type.Optional(Type.String()),
            created_at: Type.String(),
            updated_at: Type.String(),
            deleted_at: Type.Optional(Type.String()),
          })),
          conflicts: Type.Optional(Type.Array(Type.Object({
            clientVersion: Type.Object({
              id: Type.String(),
              name: Type.String(),
              duration_minutes: Type.Array(Type.Integer()),
              weekdays: Type.Array(Type.Integer()),
              exclude_holidays: Type.Optional(Type.Boolean()),
              state_code: Type.Optional(Type.String()),
              starting_from: Type.Optional(Type.String()),
              updated_at: Type.Optional(Type.String()),
              deleted_at: Type.Optional(Type.String()),
            }),
            serverVersion: Type.Object({
              id: Type.String(),
              name: Type.String(),
              duration_minutes: Type.Array(Type.Number()),
              weekdays: Type.Array(Type.Number()),
              exclude_holidays: Type.Optional(Type.Boolean()),
              state_code: Type.Optional(Type.String()),
              starting_from: Type.Optional(Type.String()),
              created_at: Type.String(),
              updated_at: Type.String(),
              deleted_at: Type.Optional(Type.String()),
            }),
          }))),
          cursor: Type.String(),
        }),
      }
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { targets } = request.body;
    
    // Convert string dates to Date objects
    const processedTargets = targets.map(t => ({
      ...t,
      starting_from: t.starting_from ? dayjs(t.starting_from).toDate() : undefined,
      updated_at: t.updated_at ? dayjs(t.updated_at).toDate() : undefined,
      deleted_at: t.deleted_at ? dayjs(t.deleted_at).toDate() : undefined,
    }));
    
    const result = await targetService.pushTargetChanges(userId, processedTargets);

    // Cursor represents the current server state after this operation
    const cursor = dayjs().toISOString();
    
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
}
