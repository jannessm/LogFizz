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
}
