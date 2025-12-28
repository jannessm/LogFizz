import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { BalanceService } from '../services/balance.service.js';
import dayjs from '../../../lib/utils/dayjs.js';

const balanceService = new BalanceService();

export async function balanceRoutes(fastify: FastifyInstance) {
  // Middleware to check authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

  // Sync endpoint - Get monthly balances changed since timestamp
  fastify.get('/sync', {
    schema: {
      tags: ['Balance'],
      querystring: Type.Object({
        since: Type.String({ format: 'date-time' }),
      }),
      response: {
        200: Type.Object({
          balances: Type.Array(Type.Object({
            id: Type.String(),
            user_id: Type.String(),
            target_id: Type.String(),
            next_balance_id: Type.Optional(Type.String()),

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

      const balances = await balanceService.getChangedBalancesSince(userId, sinceDate.toDate());
      
      // Cursor represents the current server state
      const cursor = dayjs().toISOString();
      
      return reply.send({
        balances,
        cursor,
      });
    } catch (error) {
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
