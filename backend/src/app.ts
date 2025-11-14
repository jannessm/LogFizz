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
import { dailyTargetRoutes } from './routes/daily-target.routes.js';
import { registerRateLimit } from './config/rateLimit.js';
import './types/session.js';

export async function buildApp() {
  // Disable logging in test environment to reduce noise
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  
  const fastify = Fastify({
    logger: !isTest,
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register CORS
  // Allow multiple origins for development and docker scenarios
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://localhost:8080', // Frontend in docker
    'http://127.0.0.1:8080',
  ];
  
  // Add custom frontend URL if specified
  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc)
      if (!origin) {
        callback(null, true);
        return;
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      
      // In production, also check if it matches the frontend URL pattern
      if (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL) {
        callback(null, origin === process.env.FRONTEND_URL);
        return;
      }
      
      // Log rejected origins for debugging
      console.warn(`CORS: Rejected origin: ${origin}`);
      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  // Register cookie support
  await fastify.register(cookie);

  // Register session support
  await fastify.register(session, {
    secret: process.env.SESSION_SECRET || 'a-very-secret-key-minimum-32-chars-change-in-production',
    cookieName: 'sessionId', // Explicit cookie name
    cookie: {
      secure: false, // Set to false for tests and development
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax', // Use 'lax' for better compatibility
      path: '/',
    },
    saveUninitialized: false, // Don't create session until something is stored
    rolling: false, // Don't reset cookie expiration on every response (for better test stability)
  });

  // Add request logging hook for debugging
  fastify.addHook('onRequest', async (request, reply) => {
    if (!isTest) {
      console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
      console.log('Request headers:', {
        origin: request.headers.origin,
        cookie: request.headers.cookie,
        'content-type': request.headers['content-type'],
      });
    }
  });

  fastify.addHook('onSend', async (request, reply) => {
    if (!isTest && request.url.includes('/login')) {
      console.log('Response headers for login:', {
        'set-cookie': reply.getHeader('set-cookie'),
        'access-control-allow-credentials': reply.getHeader('access-control-allow-credentials'),
        'access-control-allow-origin': reply.getHeader('access-control-allow-origin'),
      });
    }
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
        { name: 'DailyTargets', description: 'Daily target management endpoints' },
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
  await fastify.register(dailyTargetRoutes, { prefix: '/api/targets' });

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
