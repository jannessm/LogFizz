import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HolidayService } from '../services/holiday.service.js';
import { HolidayCrawlerService } from '../services/holiday-crawler.service.js';
import { GermanStateHolidayCrawlerService } from '../services/german-state-holiday-crawler.service.js';
import { EmailService } from '../services/email.service.js';

const holidayService = new HolidayService();
const crawlerService = new HolidayCrawlerService();
const germanStateCrawler = new GermanStateHolidayCrawlerService();
const emailService = new EmailService();

// Track last auto-update check to avoid checking on every request
let lastAutoUpdateCheck: Date | null = null;

export async function holidayRoutes(fastify: FastifyInstance) {
  // Helper to check and trigger auto-update for German states
  async function checkAndTriggerAutoUpdate() {
    // Only check once per hour
    if (lastAutoUpdateCheck) {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      if (lastAutoUpdateCheck > oneHourAgo) {
        return;
      }
    }

    lastAutoUpdateCheck = new Date();

    // Check if German states need update
    const needsUpdate = await germanStateCrawler.needsAnyUpdate();
    
    if (needsUpdate) {
      console.log('German state holidays need update - triggering auto-update...');
      
      // Run update in background
      germanStateCrawler.autoUpdateHolidays()
        .then(async (summary) => {
          console.log('Auto-update completed successfully');
          
          // Send notification email to admin
          const adminEmail = process.env.ADMIN_EMAIL;
          if (adminEmail && summary.updatedStates.length > 0) {
            try {
              await emailService.sendHolidayUpdateNotification(adminEmail, summary);
              console.log('Admin notification sent');
            } catch (error) {
              console.error('Failed to send admin notification:', error);
            }
          }
        })
        .catch((error) => {
          console.error('Auto-update failed:', error);
        });
    }
  }

  // Get holidays for a country and year
  // Automatically fetches from API if data is missing or outdated
  fastify.get('/:country/:year', {
    schema: {
      tags: ['Holidays'],
      params: Type.Object({
        country: Type.String(),
        year: Type.Number(),
      }),
      querystring: Type.Object({
        state: Type.Optional(Type.String()),
      }),
    },
  }, async (request, reply) => {
    const { country, year } = request.params as any;
    const { state } = request.query as any;
    
    // Trigger auto-update check (async, doesn't block response)
    checkAndTriggerAutoUpdate().catch(err => console.error('Auto-update check failed:', err));
    
    // Check if we need to fetch data
    const needsRefresh = await crawlerService.needsRefresh(country, year);
    if (needsRefresh) {
      console.log(`Auto-fetching holidays for ${country} ${year}...`);
      await crawlerService.crawlHolidays(country, year);
    }
    
    const holidays = await holidayService.getHolidays(country, year, state);
    return reply.send(holidays);
  });

  // Get working days summary
  fastify.get('/workingdays/summary', {
    schema: {
      tags: ['Holidays'],
      querystring: Type.Object({
        country: Type.String(),
        year: Type.Number(),
        state: Type.Optional(Type.String()),
      }),
    },
  }, async (request, reply) => {
    const { country, year, state } = request.query as any;
    const summary = await holidayService.getWorkingDaysSummary(country, year, state);
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
        state: Type.Optional(Type.String()),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          country: Type.String(),
          date: Type.String(),
          name: Type.String(),
          year: Type.Number(),
          state: Type.Optional(Type.String()),
        }),
      },
    },
  }, async (request, reply) => {
    const { country, date, name, year, state } = request.body as any;
    const holiday = await holidayService.addHoliday(country, new Date(date), name, year, state);
    
    return reply.code(201).send({
      id: holiday.id,
      country: holiday.country,
      date: holiday.date.toISOString(),
      name: holiday.name,
      year: holiday.year,
      state: holiday.state,
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
