import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { AppDataSource } from './config/database.js';
import { authRoutes } from './routes/auth.routes.js';
import { buttonRoutes } from './routes/button.routes.js';
import { timeLogRoutes } from './routes/timelog.routes.js';
import { holidayRoutes } from './routes/holiday.routes.js';
import { registerRateLimit } from './config/rateLimit.js';
import './types/session.js';

export async function buildApp() {
  // Disable logging in test environment to reduce noise
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  
  const fastify = Fastify({
    logger: !isTest,
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register cookie support
  await fastify.register(cookie);

  // Register session support
  await fastify.register(session, {
    secret: process.env.SESSION_SECRET || 'a-very-secret-key-minimum-32-chars-change-in-production',
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  });

  // Register rate limiting
  await registerRateLimit(fastify);

  // Register Swagger
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Clock Time Tracking API',
        description: 'API for the Clock time tracking application',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'Authentication', description: 'Authentication endpoints' },
        { name: 'Buttons', description: 'Button management endpoints' },
        { name: 'TimeLogs', description: 'Time logging endpoints' },
        { name: 'Holidays', description: 'Holiday management endpoints' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(buttonRoutes, { prefix: '/api/buttons' });
  await fastify.register(timeLogRoutes, { prefix: '/api/timelogs' });
  await fastify.register(holidayRoutes, { prefix: '/api/holidays' });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return fastify;
}

export async function startServer() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    // Run migrations in production
    if (process.env.NODE_ENV === 'production') {
      console.log('Running database migrations...');
      await AppDataSource.runMigrations();
      console.log('✓ Migrations completed');
    }

    const app = await buildApp();

    const host = process.env.HOST || '0.0.0.0';
    const port = parseInt(process.env.PORT || '3000');

    await app.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);
    console.log(`API Documentation available at http://${host}:${port}/docs`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}
