import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HolidayService } from '../services/holiday.service.js';
import { HolidayCrawlerService } from '../services/holiday-crawler.service.js';

const holidayService = new HolidayService();
const crawlerService = new HolidayCrawlerService();

export async function holidayRoutes(fastify: FastifyInstance) {
  // Get holidays for a country and year
  // Automatically fetches from API if data is missing or outdated
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
    
    // Check if we need to fetch data
    const needsRefresh = await crawlerService.needsRefresh(country, year);
    if (needsRefresh) {
      console.log(`Auto-fetching holidays for ${country} ${year}...`);
      await crawlerService.crawlHolidays(country, year);
    }
    
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

  // Crawl holidays for a specific country and year
  fastify.post('/crawl', {
    schema: {
      tags: ['Holidays'],
      body: Type.Object({
        country: Type.String(),
        year: Type.Number(),
        force: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          holidayCount: Type.Number(),
          message: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { country, year, force } = request.body as any;
    const result = await crawlerService.crawlHolidays(country, year, force || false);
    return reply.send(result);
  });

  // Get crawler metadata
  fastify.get('/metadata', {
    schema: {
      tags: ['Holidays'],
    },
  }, async (request, reply) => {
    const metadata = await crawlerService.getAllMetadata();
    return reply.send(metadata);
  });

  // Get list of available countries
  fastify.get('/countries', {
    schema: {
      tags: ['Holidays'],
    },
  }, async (request, reply) => {
    const countries = await crawlerService.getAvailableCountries();
    return reply.send({ countries });
  });

  // Refresh outdated holiday data (admin endpoint)
  fastify.post('/refresh', {
    schema: {
      tags: ['Holidays'],
      response: {
        200: Type.Object({
          refreshed: Type.Number(),
          failed: Type.Number(),
          details: Type.Array(Type.Object({
            country: Type.String(),
            year: Type.Number(),
            success: Type.Boolean(),
            message: Type.String(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const result = await crawlerService.refreshOutdatedHolidays();
    return reply.send(result);
  });
}
