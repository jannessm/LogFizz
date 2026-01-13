import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { BalanceService } from '../services/balance.service.js';
import dayjs from '../../../lib/utils/dayjs.js';

const balanceService = new BalanceService();

// Schema for balance input
const BalanceInputSchema = Type.Object({
  id: Type.Optional(Type.String()),
  target_id: Type.String(),
  date: Type.String(),
  due_minutes: Type.Integer(),
  worked_minutes: Type.Integer(),
  cumulative_minutes: Type.Integer(),
  sick_days: Type.Integer(),
  holidays: Type.Integer(),
  business_trip: Type.Integer(),
  child_sick: Type.Integer(),
  worked_days: Type.Integer(),
  updated_at: Type.Optional(Type.String()),
  created_at: Type.Optional(Type.String()),
});

// Schema for balance output
const BalanceSchema = Type.Object({
  id: Type.String(),
  user_id: Type.String(),
  target_id: Type.String(),
  date: Type.String(),
  due_minutes: Type.Integer(),
  worked_minutes: Type.Integer(),
  cumulative_minutes: Type.Integer(),
  sick_days: Type.Integer(),
  holidays: Type.Integer(),
  business_trip: Type.Integer(),
  child_sick: Type.Integer(),
  worked_days: Type.Integer(),
  created_at: Type.String(),
  updated_at: Type.String(),
});

export async function balanceRoutes(fastify: FastifyInstance) {
  // Middleware to check authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

  // GET /api/balances/sync - Get balances changed since timestamp
  fastify.get('/sync', {
    schema: {
      tags: ['Balance'],
      querystring: Type.Object({
        since: Type.String({ format: 'date-time' }),
      }),
      response: {
        200: Type.Object({
          balances: Type.Array(BalanceSchema),
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

      const balances = await balanceService.getChangedBalancesSince(userId, sinceDate.toDate());
      
      // Cursor represents the current server state
      const cursor = dayjs().toISOString();
      
      return reply.send({
        balances,
        cursor,
      });
    } catch (error) {
      console.error('Error fetching balances:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /api/balances/sync - Push local changes to server
  fastify.post('/sync', {
    schema: {
      tags: ['Balance'],
      body: Type.Object({
        balances: Type.Array(BalanceInputSchema),
      }),
      response: {
        200: Type.Object({
          saved: Type.Optional(Type.Array(BalanceSchema)),
          conflicts: Type.Optional(Type.Array(Type.Object({
            clientVersion: BalanceInputSchema,
            serverVersion: BalanceSchema,
          }))),
          cursor: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { balances } = request.body as any;

    try {
      // Convert string dates to Date objects
      const processedBalances = balances.map((b: any) => ({
        ...b,
        updated_at: b.updated_at ? dayjs(b.updated_at).toDate() : undefined,
        created_at: b.created_at ? dayjs(b.created_at).toDate() : undefined,
        deleted_at: b.deleted_at ? dayjs(b.deleted_at).toDate() : undefined,
      }));

      const result = await balanceService.pushBalanceChanges(userId, processedBalances);

      // Cursor represents the current server state after this operation
      const cursor = dayjs().toISOString();

      const response: any = {
        cursor,
      };

      if (result.conflicts.length > 0) {
        response.conflicts = result.conflicts.map(c => ({
          clientVersion: {
            ...c.clientVersion,
            updated_at: c.clientVersion.updated_at instanceof Date 
              ? c.clientVersion.updated_at.toISOString() 
              : c.clientVersion.updated_at,
          },
          serverVersion: {
            id: c.serverVersion.id,
            user_id: c.serverVersion.user_id,
            target_id: c.serverVersion.target_id,
            date: c.serverVersion.date,
            due_minutes: c.serverVersion.due_minutes,
            worked_minutes: c.serverVersion.worked_minutes,
            cumulative_minutes: c.serverVersion.cumulative_minutes,
            sick_days: c.serverVersion.sick_days,
            holidays: c.serverVersion.holidays,
            business_trip: c.serverVersion.business_trip,
            child_sick: c.serverVersion.child_sick,
            worked_days: c.serverVersion.worked_days,
            created_at: c.serverVersion.created_at.toISOString(),
            updated_at: c.serverVersion.updated_at.toISOString(),
          },
        }));
      }

      if (result.saved.length > 0) {
        response.saved = result.saved;
      }

      return reply.send(response);
    } catch (error) {
      console.error('Error pushing balance changes:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
