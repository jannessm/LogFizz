import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { MonthlyBalanceService } from '../services/monthly-balance.service.js';
import dayjs from '../../../lib/utils/dayjs.js';

const monthlyBalanceService = new MonthlyBalanceService();

export async function monthlyBalanceRoutes(fastify: FastifyInstance) {
  // Middleware to check authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

  // Sync endpoint - Get monthly balances changed since timestamp
  fastify.get('/sync', {
    schema: {
      tags: ['MonthlyBalance'],
      querystring: Type.Object({
        since: Type.String({ format: 'date-time' }),
      }),
      response: {
        200: Type.Object({
          monthlyBalances: Type.Array(Type.Object({
            id: Type.String(),
            user_id: Type.String(),
            target_id: Type.String(),
            year: Type.Integer(),
            month: Type.Integer(),
            worked_minutes: Type.Integer(),
            due_minutes: Type.Integer(),
            balance_minutes: Type.Integer(),
            exclude_holidays: Type.Boolean(),
            created_at: Type.String(),
            updated_at: Type.String(),
            target: Type.Optional(Type.Object({
              id: Type.String(),
              name: Type.String(),
              duration_minutes: Type.Array(Type.Integer()),
              weekdays: Type.Array(Type.Integer()),
              exclude_holidays: Type.Boolean(),
            })),
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

      const monthlyBalances = await monthlyBalanceService.getChangedMonthlyBalancesSince(userId, sinceDate.toDate());
      
      // Cursor represents the current server state
      const cursor = dayjs().toISOString();
      
      return reply.send({
        monthlyBalances,
        cursor,
      });
    } catch (error) {
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
