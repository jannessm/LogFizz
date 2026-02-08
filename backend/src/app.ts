import './env.js';
import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import RedisStore from 'fastify-session-redis-store';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { AppDataSource } from './config/database.js';
import { createRedisClient, getRedisClient } from './config/redis.js';
import { authRoutes } from './routes/auth.routes.js';
import { timerRoutes } from './routes/timer.routes.js';
import { timeLogRoutes } from './routes/timelog.routes.js';
import { holidayRoutes } from './routes/holiday.routes.js';
import { targetRoutes } from './routes/target.routes.js';
import { stateRoutes } from './routes/state.routes.js';
import { balanceRoutes } from './routes/balance.routes.js';
import { paymentRoutes } from './routes/payment.routes.js';
import { userSettingsRoutes } from './routes/user-settings.routes.js';
import { registerRateLimit } from './config/rateLimit.js';
import { debugRoutes } from './routes/debug.routes.js';
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

  // Initialize Redis client for session storage
  const redis = createRedisClient();
  
  // Register session support with Redis store if available
  const sessionConfig: any = {
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
  };

  // Use Redis store if Redis is available
  if (redis) {
    sessionConfig.store = new RedisStore({
      client: redis,
      prefix: 'session:',
      ttl: 24 * 60 * 60, // 24 hours in seconds
    });
    console.log('✓ Session storage configured with Redis');
  } else {
    console.log('⚠ Session storage using in-memory store (not recommended for production)');
  }

  await fastify.register(session, sessionConfig);

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
        { name: 'Timers', description: 'Timer management endpoints' },
        { name: 'TimeLogs', description: 'Time logging endpoints' },
        { name: 'Holidays', description: 'Holiday management endpoints' },
        { name: 'Targets', description: 'Target management endpoints' },
        { name: 'Balance', description: 'Balance management endpoints' },
        { name: 'States', description: 'German states reference endpoints' },
        { name: 'Payment', description: 'Payment and subscription endpoints' },
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
  await fastify.register(timerRoutes, { prefix: '/api/timers' });
  await fastify.register(timeLogRoutes, { prefix: '/api/timelogs' });
  await fastify.register(holidayRoutes, { prefix: '/api/holidays' });
  await fastify.register(targetRoutes, { prefix: '/api/targets' });
  await fastify.register(balanceRoutes, { prefix: '/api/balances' });
  await fastify.register(stateRoutes, { prefix: '/api' });
  await fastify.register(paymentRoutes, { prefix: '/api/payment' });
  await fastify.register(userSettingsRoutes, { prefix: '/api/user-settings' });

  if (process.env.NODE_ENV !== 'production') {
    await fastify.register(debugRoutes, { prefix: '/api/debug' });
  }

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

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      
      try {
        // Close Fastify server
        await app.close();
        console.log('✓ HTTP server closed');
        
        // Close Redis connection
        const redis = getRedisClient();
        if (redis) {
          await redis.quit();
          console.log('✓ Redis connection closed');
        }
        
        // Close database connection
        await AppDataSource.destroy();
        console.log('✓ Database connection closed');
        
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    await app.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);
    console.log(`API Documentation available at http://${host}:${port}/docs`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}
