import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  return redisClient;
}

export function createRedisClient(): Redis | null {
  // Check if Redis is configured
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
  
  // Skip Redis in test environment unless explicitly configured
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  if (isTest && !redisHost) {
    console.log('Redis disabled in test environment (no REDIS_HOST configured)');
    return null;
  }

  // Skip Redis if not configured
  if (!redisHost) {
    console.log('Redis not configured (REDIS_HOST not set). Sessions will use in-memory storage.');
    return null;
  }

  try {
    redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      console.log('✓ Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });

    redisClient.on('close', () => {
      console.log('Redis connection closed');
    });

    // Attempt to connect
    redisClient.connect().catch((err) => {
      console.error('Failed to connect to Redis:', err);
      redisClient = null;
    });

    return redisClient;
  } catch (error) {
    console.error('Error creating Redis client:', error);
    return null;
  }
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
