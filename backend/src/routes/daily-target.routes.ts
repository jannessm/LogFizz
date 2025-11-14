import { FastifyInstance } from 'fastify';
import { DailyTargetService } from '../services/daily-target.service.js';

const targetService = new DailyTargetService();

export async function dailyTargetRoutes(fastify: FastifyInstance) {
  // Middleware to check authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

  // GET /api/targets - Get all user's targets
  fastify.get('/api/targets', async (request, reply) => {
    const userId = request.session.userId!;
    const targets = await targetService.getUserTargets(userId);
    return reply.send({ targets });
  });

  // GET /api/targets/:id - Get a specific target
  fastify.get<{
    Params: { id: string }
  }>('/api/targets/:id', async (request, reply) => {
    const userId = request.session.userId!;
    const { id } = request.params;
      
      const target = await targetService.getTargetById(id, userId);
      
      if (!target) {
        return reply.status(404).send({ error: 'Target not found' });
      }
      
      return reply.send({ target });
    });

  // POST /api/targets - Create a new target
  fastify.post<{
    Body: {
      id?: string;
      name: string;
      duration_minutes: number;
      weekdays: number[];
    }
  }>('/api/targets', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'duration_minutes', 'weekdays'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string', minLength: 1 },
          duration_minutes: { type: 'integer', minimum: 0 },
          weekdays: {
            type: 'array',
            items: { type: 'integer', minimum: 0, maximum: 6 },
            minItems: 1,
            maxItems: 7
          }
        }
      }
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const data = request.body;
      
      const target = await targetService.createTarget(userId, data);
      
      return reply.status(201).send({ target });
  });

  // PUT /api/targets/:id - Update a target
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      duration_minutes?: number;
      weekdays?: number[];
    }
  }>('/api/targets/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          duration_minutes: { type: 'integer', minimum: 0 },
          weekdays: {
            type: 'array',
            items: { type: 'integer', minimum: 0, maximum: 6 },
            minItems: 1,
            maxItems: 7
          }
        }
      }
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { id } = request.params;
    const updates = request.body;
      
      const target = await targetService.updateTarget(id, userId, updates);
      
      if (!target) {
        return reply.status(404).send({ error: 'Target not found' });
      }
      
      return reply.send({ target });
  });

  // DELETE /api/targets/:id - Delete (soft delete) a target
  fastify.delete<{
    Params: { id: string }
  }>('/api/targets/:id', async (request, reply) => {
    const userId = request.session.userId!;
    const { id } = request.params;
      
      const deleted = await targetService.deleteTarget(id, userId);
      
      if (!deleted) {
        return reply.status(404).send({ error: 'Target not found' });
      }
      
      return reply.status(204).send();
  });

  // GET /api/sync/targets - Get targets changed since timestamp
  fastify.get<{
    Querystring: { since: string }
  }>('/api/sync/targets', {
    schema: {
      querystring: {
        type: 'object',
        required: ['since'],
        properties: {
          since: { type: 'string' }
        }
      }
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { since } = request.query;
      
      const sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return reply.status(400).send({ error: 'Invalid since timestamp' });
      }
      
      const targets = await targetService.getChangedTargetsSince(userId, sinceDate);
      
      return reply.send({ targets });
  });

  // POST /api/sync/targets/push - Push local changes to server
  fastify.post<{
    Body: {
      targets: Array<{
        id?: string;
        name: string;
        duration_minutes: number;
        weekdays: number[];
        updated_at?: string;
        deleted_at?: string;
      }>
    }
  }>('/api/sync/targets/push', {
    schema: {
      body: {
        type: 'object',
        required: ['targets'],
        properties: {
          targets: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'duration_minutes', 'weekdays'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                duration_minutes: { type: 'integer' },
                weekdays: { type: 'array', items: { type: 'integer' } },
                updated_at: { type: 'string' },
                deleted_at: { type: 'string' }
              }
            }
          }
        }
      }
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { targets } = request.body;
    
    // Convert string dates to Date objects
    const targetsWithDates = targets.map(t => ({
      ...t,
      updated_at: t.updated_at ? new Date(t.updated_at) : undefined,
      deleted_at: t.deleted_at ? new Date(t.deleted_at) : undefined,
    }));
    
    const result = await targetService.pushTargetChanges(userId, targetsWithDates);
      
      if (result.conflicts.length > 0) {
        return reply.status(409).send({
          message: 'Conflicts detected',
          conflicts: result.conflicts,
          saved: result.saved
        });
      }
      
      return reply.send({ targets: result.saved });
  });
}
