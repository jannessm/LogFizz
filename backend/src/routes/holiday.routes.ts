import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HolidayService } from '../services/holiday.service';

const holidayService = new HolidayService();

export async function holidayRoutes(fastify: FastifyInstance) {
  // Get holidays for a country and year
  fastify.get('/:country/:year', {
    schema: {
      tags: ['Holidays'],
      params: Type.Object({
        country: Type.String(),
        year: Type.Number(),
      }),
    },
  }, async (request, reply) => {
    const { country, year } = request.params as any;
    const holidays = await holidayService.getHolidays(country, year);
    return reply.send(holidays);
  });

  // Get working days summary
  fastify.get('/workingdays/summary', {
    schema: {
      tags: ['Holidays'],
      querystring: Type.Object({
        country: Type.String(),
        year: Type.Number(),
      }),
    },
  }, async (request, reply) => {
    const { country, year } = request.query as any;
    const summary = await holidayService.getWorkingDaysSummary(country, year);
    return reply.send(summary);
  });

  // Add a holiday (protected endpoint)
  fastify.post('/', {
    schema: {
      tags: ['Holidays'],
      body: Type.Object({
        country: Type.String(),
        date: Type.String(),
        name: Type.String(),
        year: Type.Number(),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          country: Type.String(),
          date: Type.String(),
          name: Type.String(),
          year: Type.Number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { country, date, name, year } = request.body as any;
    const holiday = await holidayService.addHoliday(country, new Date(date), name, year);
    
    return reply.code(201).send({
      id: holiday.id,
      country: holiday.country,
      date: holiday.date.toISOString(),
      name: holiday.name,
      year: holiday.year,
    });
  });

  // Delete a holiday
  fastify.delete('/:id', {
    schema: {
      tags: ['Holidays'],
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
    const { id } = request.params as any;
    const success = await holidayService.deleteHoliday(id);
    
    if (!success) {
      return reply.code(404).send({ error: 'Holiday not found' });
    }

    return reply.send({ message: 'Holiday deleted successfully' });
  });
}
