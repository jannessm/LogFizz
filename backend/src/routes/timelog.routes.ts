import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TimeLogService } from '../services/timelog.service.js';
import dayjs from '../../../lib/utils/dayjs.js';

const timeLogService = new TimeLogService();

export async function timeLogRoutes(fastify: FastifyInstance) {
  // Middleware to check authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

  // Sync endpoint - Get time logs changed since timestamp
  fastify.get('/sync', {
    schema: {
      tags: ['TimeLogs'],
      querystring: Type.Object({
        since: Type.String({ format: 'date-time' }),
      }),
      response: {
        200: Type.Object({
          timeLogs: Type.Array(Type.Object({
            id: Type.String(),
            timer_id: Type.String(),
            type: Type.String(),
            whole_day: Type.Boolean(),
            apply_break_calculation: Type.Boolean(),
            start_timestamp: Type.String(),
            end_timestamp: Type.Optional(Type.String()),
            duration_minutes: Type.Optional(Type.Number()),
            timezone: Type.String(),
            notes: Type.Optional(Type.String()),
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

      const timeLogs = await timeLogService.getChangedTimeLogsSince(userId, sinceDate.toDate());
      
      // Cursor represents the current server state - all changes up to this moment have been returned
      // Next sync should request changes after this timestamp
      const cursor = dayjs().toISOString();
      
      return reply.send({
        timeLogs,
        cursor
      });
    } catch (error) {
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Sync endpoint - Push time log changes
  fastify.post('/sync', {
    schema: {
      tags: ['TimeLogs'],
      body: Type.Object({
        timeLogs: Type.Array(Type.Object({
          id: Type.String(), // Required for offline-first with client-generated UUIDs
          timer_id: Type.String(),
          type: Type.Optional(Type.String()),
          whole_day: Type.Optional(Type.Boolean()),
          apply_break_calculation: Type.Optional(Type.Boolean()),
          start_timestamp: Type.String(),
          end_timestamp: Type.Optional(Type.String()),
          duration_minutes: Type.Optional(Type.Number()),
          timezone: Type.String(),
          notes: Type.Optional(Type.String()),
          updated_at: Type.Optional(Type.String()),
          deleted_at: Type.Optional(Type.String()),
        })),
      }),
      response: {
        200: Type.Object({
          saved: Type.Optional(Type.Array(Type.Object({
            id: Type.String(),
            timer_id: Type.String(),
            type: Type.String(),
            whole_day: Type.Boolean(),
            apply_break_calculation: Type.Boolean(),
            start_timestamp: Type.String(),
            end_timestamp: Type.Optional(Type.String()),
            duration_minutes: Type.Optional(Type.Number()),
            timezone: Type.String(),
            notes: Type.Optional(Type.String()),
            created_at: Type.String(),
            updated_at: Type.String(),
            deleted_at: Type.Optional(Type.String()),
          }))),
          conflicts: Type.Optional(Type.Array(Type.Object({
            clientVersion: Type.Object({
              id: Type.String(),
              timer_id: Type.String(),
              type: Type.Optional(Type.String()),
              whole_day: Type.Optional(Type.Boolean()),
              apply_break_calculation: Type.Optional(Type.Boolean()),
              start_timestamp: Type.String(),
              end_timestamp: Type.Optional(Type.String()),
              duration_minutes: Type.Optional(Type.Number()),
              timezone: Type.String(),
              notes: Type.Optional(Type.String()),
              updated_at: Type.Optional(Type.String()),
              deleted_at: Type.Optional(Type.String()),
            }),
            serverVersion: Type.Object({
              id: Type.String(),
              timer_id: Type.String(),
              type: Type.String(),
              whole_day: Type.Boolean(),
              apply_break_calculation: Type.Boolean(),
              start_timestamp: Type.String(),
              end_timestamp: Type.Optional(Type.String()),
              duration_minutes: Type.Optional(Type.Number()),
              timezone: Type.String(),
              notes: Type.Optional(Type.String()),
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
    const { timeLogs } = request.body as any;

    // Convert string timestamps to Date objects
    const processedTimeLogs = timeLogs.map((log: any) => ({
      ...log,
      start_timestamp: dayjs(log.start_timestamp).toDate(),
      end_timestamp: log.end_timestamp ? dayjs(log.end_timestamp).toDate() : undefined,
      updated_at: dayjs(log.updated_at).toDate(),
      deleted_at: log.deleted_at ? dayjs(log.deleted_at).toDate() : undefined,
    }));

    const result = await timeLogService.pushTimeLogChanges(userId, processedTimeLogs);
    
    // Note: Monthly balance recalculation is now handled in the frontend
    // to ensure balances are calculated correctly in offline-first scenarios
    
    // Cursor represents the current server state after this operation
    const cursor = new Date().toISOString();
    
    // If conflicts exist, only return conflicts (client needs to resolve)
    // Otherwise return saved time logs
    const response: any = {
      cursor,
    };

    if (result.conflicts.length > 0) {
      response.conflicts = result.conflicts.map(c => ({
        ...c,
        clientVersion: {
          ...c.clientVersion,
          start_timestamp: c.clientVersion.start_timestamp instanceof Date 
            ? c.clientVersion.start_timestamp.toISOString() 
            : c.clientVersion.start_timestamp,
          end_timestamp: c.clientVersion.end_timestamp instanceof Date
            ? c.clientVersion.end_timestamp.toISOString()
            : c.clientVersion.end_timestamp,
          updated_at: c.clientVersion.updated_at?.toISOString(),
          deleted_at: c.clientVersion.deleted_at?.toISOString(),
        },
        serverVersion: {
          ...c.serverVersion,
          start_timestamp: c.serverVersion.start_timestamp.toISOString(),
          end_timestamp: c.serverVersion.end_timestamp?.toISOString(),
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
