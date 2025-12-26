import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TargetService } from '../services/target.service.js';
import dayjs from '../../../lib/utils/dayjs.js';

const targetService = new TargetService();

// Schema for target spec without timestamps (for API responses)
const TargetSpecSchema = Type.Object({
  id: Type.String(),
  duration_minutes: Type.Array(Type.Number()),
  weekdays: Type.Array(Type.Number()),
  exclude_holidays: Type.Boolean(),
  state_code: Type.Optional(Type.String()),
  starting_from: Type.String(),
  ending_at: Type.Optional(Type.String()),
});

// Schema for target with nested specs (for API responses)
const TargetWithSpecsSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  target_specs: Type.Array(TargetSpecSchema),
  updated_at: Type.String(),
  deleted_at: Type.Optional(Type.String()),
});

// Schema for input (with optional fields for specs)
const TargetSpecInputSchema = Type.Object({
  id: Type.String(),
  duration_minutes: Type.Array(Type.Integer()),
  weekdays: Type.Array(Type.Integer()),
  exclude_holidays: Type.Optional(Type.Boolean()),
  state_code: Type.Optional(Type.String()),
  starting_from: Type.String(),
  ending_at: Type.Optional(Type.String()),
});

const TargetWithSpecsInputSchema = Type.Object({
  id: Type.Optional(Type.String()),
  name: Type.String(),
  target_specs: Type.Array(TargetSpecInputSchema),
  updated_at: Type.Optional(Type.String()),
  deleted_at: Type.Optional(Type.String()),
});

export async function targetRoutes(fastify: FastifyInstance) {
  // Middleware to check authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

  // GET /api/targets/sync - Get targets with nested specs changed since timestamp
  fastify.get('/sync', {
    schema: {
      tags: ['Targets'],
      querystring: Type.Object({
        since: Type.String({ format: 'date-time' }),
      }),
      response: {
        200: Type.Object({
          targets: Type.Array(TargetWithSpecsSchema),
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

      // Transform targets to match response schema (without timestamps on specs)
      const responseTargets = targets.map(t => ({
        id: t.id,
        name: t.name,
        target_specs: t.target_specs.map(s => ({
          id: s.id,
          duration_minutes: s.duration_minutes,
          weekdays: s.weekdays,
          exclude_holidays: s.exclude_holidays,
          state_code: s.state_code,
          starting_from: s.starting_from.toISOString(),
          ending_at: s.ending_at?.toISOString(),
        })),
        updated_at: t.updated_at!.toISOString(),
        deleted_at: t.deleted_at?.toISOString(),
      }));

      return reply.send({
        targets: responseTargets,
        cursor,
      });
    } catch (error) {
      console.error('Error fetching targets:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/targets/sync - Push local changes to server
  fastify.post('/sync', {
    schema: {
      tags: ['Targets'],
      body: Type.Object({
        targets: Type.Array(TargetWithSpecsInputSchema),
      }),
      response: {
        200: Type.Object({
          saved: Type.Optional(Type.Array(TargetWithSpecsSchema)),
          conflicts: Type.Optional(Type.Array(Type.Object({
            clientVersion: TargetWithSpecsInputSchema,
            serverVersion: TargetWithSpecsSchema,
          }))),
          cursor: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { targets } = request.body as any;
    
    // Convert string dates to Date objects
    const processedTargets = targets.map((t: any) => ({
      ...t,
      updated_at: t.updated_at ? dayjs(t.updated_at).toDate() : undefined,
      deleted_at: t.deleted_at ? dayjs(t.deleted_at).toDate() : undefined,
      target_specs: (t.target_specs || []).map((s: any) => ({
        ...s,
        starting_from: dayjs(s.starting_from).toDate(),
        ending_at: s.ending_at ? dayjs(s.ending_at).toDate() : undefined,
      })),
    }));
    
    const result = await targetService.pushTargetChanges(userId, processedTargets);

    // Cursor represents the current server state after this operation
    const cursor = dayjs().toISOString();
    
    const response: any = {
      cursor,
    };

    if (result.conflicts.length > 0) {
      response.conflicts = result.conflicts.map(c => ({
        clientVersion: {
          ...c.clientVersion,
          target_specs: (c.clientVersion.target_specs || []).map(s => ({
            ...s,
            starting_from: s.starting_from instanceof Date ? s.starting_from.toISOString() : s.starting_from,
            ending_at: s.ending_at instanceof Date ? s.ending_at.toISOString() : s.ending_at,
          })),
          updated_at: c.clientVersion.updated_at instanceof Date ? c.clientVersion.updated_at.toISOString() : c.clientVersion.updated_at,
          deleted_at: c.clientVersion.deleted_at instanceof Date ? c.clientVersion.deleted_at.toISOString() : c.clientVersion.deleted_at,
        },
        serverVersion: {
          id: c.serverVersion.id,
          name: c.serverVersion.name,
          target_specs: c.serverVersion.target_specs.map(s => ({
            id: s.id,
            duration_minutes: s.duration_minutes,
            weekdays: s.weekdays,
            exclude_holidays: s.exclude_holidays,
            state_code: s.state_code,
            starting_from: s.starting_from.toISOString(),
            ending_at: s.ending_at?.toISOString(),
          })),
          updated_at: c.serverVersion.updated_at!.toISOString(),
          deleted_at: c.serverVersion.deleted_at?.toISOString(),
        },
      }));
    }
    
    if (result.saved.length > 0) {
      response.saved = result.saved.map(t => ({
        id: t.id,
        name: t.name,
        target_specs: t.target_specs.map(s => ({
          id: s.id,
          duration_minutes: s.duration_minutes,
          weekdays: s.weekdays,
          exclude_holidays: s.exclude_holidays,
          state_code: s.state_code,
          starting_from: s.starting_from.toISOString(),
          ending_at: s.ending_at?.toISOString(),
        })),
        updated_at: t.updated_at!.toISOString(),
        deleted_at: t.deleted_at?.toISOString(),
      }));
    }

    return reply.send(response);
  });
}
