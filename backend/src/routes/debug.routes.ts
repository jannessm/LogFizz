import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { EmailService } from '../services/email.service.js';

const emailService = new EmailService();

export async function debugRoutes(fastify: FastifyInstance) {

  // GET /api/debug/send-test - Send a test email
  fastify.get('/send-test', {
    schema: {
      tags: ['Email'],
      response: {
        200: Type.Any(),
      },
    },
  }, async (request, reply) => {
    emailService.sendWelcomeEmail('jannes@magnusso.nz', 'test-token', 'Test User').catch(error => {
      console.error('Failed to send test email:', error);
    });
    return reply.send({ status: 'Email sent (async)' });
  });
}
