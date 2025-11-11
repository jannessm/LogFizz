import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TimeLogService } from '../services/timelog.service.js';

const timeLogService = new TimeLogService();

export async function timeLogRoutes(fastify: FastifyInstance) {
  // Middleware to check authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

  // Start timer
  fastify.post('/start', {
    schema: {
      tags: ['TimeLogs'],
      body: Type.Object({
        button_id: Type.String(),
        timezone: Type.Optional(Type.String()),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          button_id: Type.String(),
          type: Type.String(),
          timestamp: Type.String(),
          timezone: Type.Optional(Type.String()),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.session.userId!;
      const { button_id, timezone } = request.body as any;
      const timeLog = await timeLogService.startTimer(userId, button_id, timezone);
      return reply.code(201).send({
        id: timeLog.id,
        button_id: timeLog.button_id,
        type: timeLog.type,
        timestamp: timeLog.timestamp.toISOString(),
        timezone: timeLog.timezone,
      });
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Stop timer
  fastify.post('/stop/:id', {
    schema: {
      tags: ['TimeLogs'],
      params: Type.Object({
        id: Type.String(),
      }),
      // Body is optional - if provided, it can contain timezone
      body: Type.Object({
        timezone: Type.Optional(Type.String()),
      }, { additionalProperties: false }),
      response: {
        200: Type.Object({
          id: Type.String(),
          button_id: Type.String(),
          type: Type.String(),
          timestamp: Type.String(),
          timezone: Type.Optional(Type.String()),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.session.userId!;
      const { id } = request.params as any;
      const body = request.body as any;
      const timezone = body?.timezone;
      const stopLog = await timeLogService.stopTimer(userId, id, timezone);
      return reply.send({
        id: stopLog.id,
        button_id: stopLog.button_id,
        type: stopLog.type,
        timestamp: stopLog.timestamp.toISOString(),
        timezone: stopLog.timezone,
      });
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Get active timer
  fastify.get('/active', {
    schema: {
      tags: ['TimeLogs'],
      response: {
        200: Type.Union([
          Type.Object({
            id: Type.String(),
            button_id: Type.String(),
            type: Type.String(),
            timestamp: Type.String(),
          }),
          Type.Null(),
        ]),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const timeLog = await timeLogService.getActiveTimer(userId);
    
    if (!timeLog) {
      return reply.send(null);
    }

    return reply.send({
      id: timeLog.id,
      button_id: timeLog.button_id,
      type: timeLog.type,
      timestamp: timeLog.timestamp.toISOString(),
    });
  });

  // Get time logs with filters
  fastify.get('/', {
    schema: {
      tags: ['TimeLogs'],
      querystring: Type.Object({
        startDate: Type.Optional(Type.String()),
        endDate: Type.Optional(Type.String()),
        button_id: Type.Optional(Type.String()),
      }),
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { startDate, endDate, button_id } = request.query as any;

    const timeLogs = await timeLogService.getTimeLogs(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      button_id
    );

    return reply.send(timeLogs);
  });

  // Get today's time for a button
  fastify.get('/today/:button_id', {
    schema: {
      tags: ['TimeLogs'],
      params: Type.Object({
        button_id: Type.String(),
      }),
      response: {
        200: Type.Object({
          totalMinutes: Type.Number(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { button_id } = request.params as any;
    const totalMinutes = await timeLogService.getTodayTimeForButton(userId, button_id);
    return reply.send({ totalMinutes });
  });

  // Get yearly statistics
  fastify.get('/stats/yearly', {
    schema: {
      tags: ['TimeLogs'],
      querystring: Type.Object({
        year: Type.Number(),
      }),
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { year } = request.query as any;
    const stats = await timeLogService.getYearlyStats(userId, year);
    return reply.send(stats);
  });

  // Get goal progress for a button
  fastify.get('/goal-progress/:button_id', {
    schema: {
      tags: ['TimeLogs'],
      params: Type.Object({
        button_id: Type.String(),
      }),
    },
  }, async (request, reply) => {
    try {
      const userId = request.session.userId!;
      const { button_id } = request.params as any;
      const progress = await timeLogService.getGoalProgress(userId, button_id);
      return reply.send(progress);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Create manual log
  fastify.post('/manual', {
    schema: {
      tags: ['TimeLogs'],
      body: Type.Object({
        button_id: Type.String(),
        start_time: Type.String(),
        end_time: Type.String(),
        notes: Type.Optional(Type.String()),
        timezone: Type.Optional(Type.String()),
      }),
      response: {
        201: Type.Object({
          start: Type.Object({
            id: Type.String(),
            type: Type.String(),
            timestamp: Type.String(),
            timezone: Type.Optional(Type.String()),
          }),
          stop: Type.Object({
            id: Type.String(),
            type: Type.String(),
            timestamp: Type.String(),
            timezone: Type.Optional(Type.String()),
          }),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.session.userId!;
      const { button_id, start_time, end_time, notes, timezone } = request.body as any;
      const logs = await timeLogService.createManualLog(
        userId,
        button_id,
        new Date(start_time),
        new Date(end_time),
        notes,
        timezone
      );
      return reply.code(201).send({
        start: {
          id: logs.start.id,
          type: logs.start.type,
          timestamp: logs.start.timestamp.toISOString(),
          timezone: logs.start.timezone,
        },
        stop: {
          id: logs.stop.id,
          type: logs.stop.type,
          timestamp: logs.stop.timestamp.toISOString(),
          timezone: logs.stop.timezone,
        },
      });
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Update time log
  fastify.put('/:id', {
    schema: {
      tags: ['TimeLogs'],
      params: Type.Object({
        id: Type.String(),
      }),
      body: Type.Object({
        timestamp: Type.Optional(Type.String()),
        notes: Type.Optional(Type.String()),
        apply_break_calculation: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          button_id: Type.String(),
          type: Type.String(),
          timestamp: Type.String(),
          notes: Type.Optional(Type.String()),
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

    if (updates.timestamp) {
      updates.timestamp = new Date(updates.timestamp);
    }

    const timeLog = await timeLogService.updateTimeLog(userId, id, updates);
    if (!timeLog) {
      return reply.code(404).send({ error: 'Time log not found' });
    }

    return reply.send({
      id: timeLog.id,
      button_id: timeLog.button_id,
      type: timeLog.type,
      timestamp: timeLog.timestamp.toISOString(),
      notes: timeLog.notes,
    });
  });

  // Delete time log
  fastify.delete('/:id', {
    schema: {
      tags: ['TimeLogs'],
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

    const success = await timeLogService.deleteTimeLog(userId, id);
    if (!success) {
      return reply.code(404).send({ error: 'Time log not found' });
    }

    return reply.send({ message: 'Time log deleted successfully' });
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
            button_id: Type.String(),
            type: Type.String(),
            timestamp: Type.String(),
            timezone: Type.Optional(Type.String()),
            apply_break_calculation: Type.Boolean(),
            notes: Type.Optional(Type.String()),
            is_manual: Type.Boolean(),
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

      const timeLogs = await timeLogService.getChangedTimeLogsSince(userId, sinceDate);
      
      // Cursor represents the current server state - all changes up to this moment have been returned
      // Next sync should request changes after this timestamp
      const cursor = new Date().toISOString();
      
      return reply.send({
        timeLogs: timeLogs.map(log => ({
          id: log.id,
          button_id: log.button_id,
          type: log.type,
          timestamp: log.timestamp.toISOString(),
          timezone: log.timezone,
          apply_break_calculation: log.apply_break_calculation,
          notes: log.notes,
          is_manual: log.is_manual,
          created_at: log.created_at.toISOString(),
          updated_at: log.updated_at.toISOString(),
          deleted_at: log.deleted_at?.toISOString(),
        })),
        cursor,
      });
    } catch (error) {
      return reply.code(400).send({ error: 'Invalid timestamp' });
    }
  });

  // Sync endpoint - Push time log changes
  fastify.post('/sync', {
    schema: {
      tags: ['TimeLogs'],
      body: Type.Object({
        timeLogs: Type.Array(Type.Object({
          id: Type.String(), // Required for offline-first with client-generated UUIDs
          button_id: Type.String(),
          type: Type.String(),
          timestamp: Type.String(),
          timezone: Type.Optional(Type.String()),
          apply_break_calculation: Type.Optional(Type.Boolean()),
          notes: Type.Optional(Type.String()),
          is_manual: Type.Optional(Type.Boolean()),
          updated_at: Type.Optional(Type.String()),
          deleted_at: Type.Optional(Type.String()),
        })),
      }),
      response: {
        200: Type.Object({
          saved: Type.Optional(Type.Array(Type.Object({
            id: Type.String(),
            button_id: Type.String(),
            type: Type.String(),
            timestamp: Type.String(),
            timezone: Type.Optional(Type.String()),
            apply_break_calculation: Type.Boolean(),
            notes: Type.Optional(Type.String()),
            is_manual: Type.Boolean(),
            created_at: Type.String(),
            updated_at: Type.String(),
            deleted_at: Type.Optional(Type.String()),
          }))),
          conflicts: Type.Optional(Type.Array(Type.Object({
            id: Type.String(),
            field: Type.Literal('timeLog'),
            clientVersion: Type.Object({
              id: Type.String(),
              button_id: Type.String(),
              type: Type.String(),
              timestamp: Type.String(),
              timezone: Type.Optional(Type.String()),
              apply_break_calculation: Type.Optional(Type.Boolean()),
              notes: Type.Optional(Type.String()),
              is_manual: Type.Optional(Type.Boolean()),
              updated_at: Type.Optional(Type.String()),
              deleted_at: Type.Optional(Type.String()),
            }),
            serverVersion: Type.Object({
              id: Type.String(),
              button_id: Type.String(),
              type: Type.String(),
              timestamp: Type.String(),
              timezone: Type.Optional(Type.String()),
              apply_break_calculation: Type.Boolean(),
              notes: Type.Optional(Type.String()),
              is_manual: Type.Boolean(),
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
      timestamp: new Date(log.timestamp),
      updated_at: log.updated_at ? new Date(log.updated_at) : undefined,
      deleted_at: log.deleted_at ? new Date(log.deleted_at) : undefined,
    }));

    const result = await timeLogService.pushTimeLogChanges(userId, processedTimeLogs);
    
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
          timestamp: c.clientVersion.timestamp instanceof Date 
            ? c.clientVersion.timestamp.toISOString() 
            : c.clientVersion.timestamp,
          updated_at: c.clientVersion.updated_at?.toISOString(),
          deleted_at: c.clientVersion.deleted_at?.toISOString(),
        },
        serverVersion: {
          ...c.serverVersion,
          timestamp: c.serverVersion.timestamp.toISOString(),
          created_at: c.serverVersion.created_at.toISOString(),
          updated_at: c.serverVersion.updated_at.toISOString(),
          deleted_at: c.serverVersion.deleted_at?.toISOString(),
        },
      }));
    }
    
    if (result.saved.length > 0) {
      response.saved = result.saved.map(log => ({
        id: log.id,
        button_id: log.button_id,
        type: log.type,
        timestamp: log.timestamp.toISOString(),
        apply_break_calculation: log.apply_break_calculation,
        notes: log.notes,
        is_manual: log.is_manual,
        created_at: log.created_at.toISOString(),
        updated_at: log.updated_at.toISOString(),
        deleted_at: log.deleted_at?.toISOString(),
      }));
    }

    return reply.send(response);
  });
}
