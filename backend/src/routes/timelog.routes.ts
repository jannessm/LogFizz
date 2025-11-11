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
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          button_id: Type.String(),
          type: Type.String(),
          timestamp: Type.String(),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.session.userId!;
      const { button_id } = request.body as any;
      const timeLog = await timeLogService.startTimer(userId, button_id);
      return reply.code(201).send({
        id: timeLog.id,
        button_id: timeLog.button_id,
        type: timeLog.type,
        timestamp: timeLog.timestamp.toISOString(),
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
      response: {
        200: Type.Object({
          id: Type.String(),
          button_id: Type.String(),
          type: Type.String(),
          timestamp: Type.String(),
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
      const stopLog = await timeLogService.stopTimer(userId, id);
      return reply.send({
        id: stopLog.id,
        button_id: stopLog.button_id,
        type: stopLog.type,
        timestamp: stopLog.timestamp.toISOString(),
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
      }),
      response: {
        201: Type.Object({
          start: Type.Object({
            id: Type.String(),
            type: Type.String(),
            timestamp: Type.String(),
          }),
          stop: Type.Object({
            id: Type.String(),
            type: Type.String(),
            timestamp: Type.String(),
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
      const { button_id, start_time, end_time, notes } = request.body as any;
      const logs = await timeLogService.createManualLog(
        userId,
        button_id,
        new Date(start_time),
        new Date(end_time),
        notes
      );
      return reply.code(201).send({
        start: {
          id: logs.start.id,
          type: logs.start.type,
          timestamp: logs.start.timestamp.toISOString(),
        },
        stop: {
          id: logs.stop.id,
          type: logs.stop.type,
          timestamp: logs.stop.timestamp.toISOString(),
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
}
