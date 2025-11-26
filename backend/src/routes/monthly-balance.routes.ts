import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { MonthlyBalanceService } from '../services/monthly-balance.service.js';

const monthlyBalanceService = new MonthlyBalanceService();

export async function monthlyBalanceRoutes(fastify: FastifyInstance) {
  // Middleware to check authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
  });

  // Get monthly balance for a specific target
  fastify.get('/:targetId/:year/:month', {
    schema: {
      tags: ['MonthlyBalance'],
      params: Type.Object({
        targetId: Type.String({ format: 'uuid' }),
        year: Type.Integer({ minimum: 2000, maximum: 2100 }),
        month: Type.Integer({ minimum: 1, maximum: 12 }),
      }),
      response: {
        200: Type.Object({
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
        }),
        404: Type.Object({
          error: Type.String(),
        }),
        500: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { targetId, year, month } = request.params as any;

    try {
      const balance = await monthlyBalanceService.getMonthlyBalance(
        userId,
        targetId,
        year,
        month
      );

      if (!balance) {
        return reply.code(404).send({ error: 'Balance not found' });
      }

      return reply.send(balance);
    } catch (error) {
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Get all monthly balances for a user in a specific month
  fastify.get('/:year/:month', {
    schema: {
      tags: ['MonthlyBalance'],
      params: Type.Object({
        year: Type.Integer({ minimum: 2000, maximum: 2100 }),
        month: Type.Integer({ minimum: 1, maximum: 12 }),
      }),
      response: {
        200: Type.Array(Type.Object({
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
        500: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { year, month } = request.params as any;

    try {
      const balances = await monthlyBalanceService.getAllMonthlyBalances(
        userId,
        year,
        month
      );

      return reply.send(balances);
    } catch (error) {
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Calculate/recalculate monthly balance for a specific target
  fastify.post('/calculate/:targetId/:year/:month', {
    schema: {
      tags: ['MonthlyBalance'],
      params: Type.Object({
        targetId: Type.String({ format: 'uuid' }),
        year: Type.Integer({ minimum: 2000, maximum: 2100 }),
        month: Type.Integer({ minimum: 1, maximum: 12 }),
      }),
      response: {
        200: Type.Object({
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
        }),
        500: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { targetId, year, month } = request.params as any;

    try {
      const balance = await monthlyBalanceService.calculateMonthlyBalance(
        userId,
        targetId,
        year,
        month
      );

      return reply.send(balance);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message || 'Internal Server Error' });
    }
  });

  // Recalculate all monthly balances for a user in a specific month
  fastify.post('/calculate/:year/:month', {
    schema: {
      tags: ['MonthlyBalance'],
      params: Type.Object({
        year: Type.Integer({ minimum: 2000, maximum: 2100 }),
        month: Type.Integer({ minimum: 1, maximum: 12 }),
      }),
      response: {
        200: Type.Array(Type.Object({
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
        500: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId!;
    const { year, month } = request.params as any;

    try {
      const balances = await monthlyBalanceService.recalculateMonthBalances(
        userId,
        year,
        month
      );

      return reply.send(balances);
    } catch (error) {
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
