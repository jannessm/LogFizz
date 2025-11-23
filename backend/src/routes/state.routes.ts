import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { StateService } from '../services/state.service.js';

const stateService = new StateService();

export async function stateRoutes(fastify: FastifyInstance) {
  // Get all states
  fastify.get('/states', {
    schema: {
      tags: ['States'],
      response: {
        200: Type.Array(Type.Object({
          id: Type.String(),
          country: Type.String(),
          state: Type.String(),
          code: Type.String(),
        })),
      },
    },
  }, async (request, reply) => {
    const states = await stateService.getAllStates();
    return reply.send(states);
  });

  // Get states by country
  fastify.get('/states/:country', {
    schema: {
      tags: ['States'],
      params: Type.Object({
        country: Type.String(),
      }),
      response: {
        200: Type.Array(Type.Object({
          id: Type.String(),
          country: Type.String(),
          state: Type.String(),
          code: Type.String(),
        })),
      },
    },
  }, async (request, reply) => {
    const { country } = request.params as any;
    const states = await stateService.getStatesByCountry(country);
    return reply.send(states);
  });
}
