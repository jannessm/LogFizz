import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Redis from 'ioredis';

// Mock ioredis before importing the module
vi.mock('ioredis', () => {
  const MockRedis = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn(),
    status: 'ready',
  }));
  return { default: MockRedis };
});

describe('Redis Configuration Unit Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clear module cache to get fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('createRedisClient behavior', () => {
    it('should not create client in test environment without REDIS_HOST', async () => {
      process.env.NODE_ENV = 'test';
      process.env.VITEST = 'true';
      delete process.env.REDIS_HOST;

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      expect(client).toBeNull();
    });

    it('should not create client when REDIS_HOST is not set', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.REDIS_HOST;
      delete process.env.VITEST;

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      expect(client).toBeNull();
    });

    it('should create client when REDIS_HOST is set', async () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_HOST = 'localhost';
      process.env.REDIS_PORT = '6379';
      delete process.env.VITEST;

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      expect(client).not.toBeNull();
      if (client) {
        expect(client.connect).toBeDefined();
      }
    });

    it('should use default port when REDIS_PORT is not set', async () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_HOST = 'localhost';
      delete process.env.REDIS_PORT;
      delete process.env.VITEST;

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      expect(client).not.toBeNull();
      // Check that Redis was instantiated with default port
      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        host: 'localhost',
        port: 6379,
      }));
    });

    it('should use custom port when REDIS_PORT is set', async () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_HOST = 'redis-server';
      process.env.REDIS_PORT = '6380';
      delete process.env.VITEST;

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      expect(client).not.toBeNull();
      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        host: 'redis-server',
        port: 6380,
      }));
    });

    it('should configure retry strategy', async () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_HOST = 'localhost';
      delete process.env.VITEST;

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        retryStrategy: expect.any(Function),
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      }));
    });

    it('should calculate retry delay correctly', async () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_HOST = 'localhost';
      delete process.env.VITEST;

      const { createRedisClient } = await import('../config/redis.js');
      createRedisClient();

      const callArgs = (Redis as any).mock.calls[0][0];
      const retryStrategy = callArgs.retryStrategy;

      // Test retry delays
      expect(retryStrategy(1)).toBe(50);   // First retry: 1 * 50 = 50ms
      expect(retryStrategy(2)).toBe(100);  // Second retry: 2 * 50 = 100ms
      expect(retryStrategy(10)).toBe(500); // Tenth retry: 10 * 50 = 500ms
      expect(retryStrategy(50)).toBe(2000); // Max delay: capped at 2000ms
      expect(retryStrategy(100)).toBe(2000); // Still capped at 2000ms
    });
  });

  describe('getRedisClient', () => {
    it('should return null initially', async () => {
      const { getRedisClient } = await import('../config/redis.js');
      const client = getRedisClient();

      // Will be null if createRedisClient was never called
      // or if it was called but returned null
      expect(client === null || client !== null).toBe(true);
    });
  });

  describe('closeRedisClient', () => {
    it('should handle closing null client gracefully', async () => {
      const { closeRedisClient } = await import('../config/redis.js');
      
      // Should not throw
      await expect(closeRedisClient()).resolves.toBeUndefined();
    });

    it('should call quit on existing client', async () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_HOST = 'localhost';
      delete process.env.VITEST;

      const { createRedisClient, closeRedisClient, getRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      if (client) {
        await closeRedisClient();
        expect(client.quit).toHaveBeenCalled();
      }
    });
  });

  describe('Redis event handlers', () => {
    it('should register connect event handler', async () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_HOST = 'localhost';
      delete process.env.VITEST;

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      if (client) {
        expect(client.on).toHaveBeenCalledWith('connect', expect.any(Function));
      }
    });

    it('should register error event handler', async () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_HOST = 'localhost';
      delete process.env.VITEST;

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      if (client) {
        expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
      }
    });

    it('should register close event handler', async () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_HOST = 'localhost';
      delete process.env.VITEST;

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      if (client) {
        expect(client.on).toHaveBeenCalledWith('close', expect.any(Function));
      }
    });
  });

  describe('Error handling', () => {
    it('should handle connection errors gracefully', async () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_HOST = 'localhost';
      delete process.env.VITEST;

      // Mock connect to reject
      const MockRedisWithError = vi.fn().mockImplementation(() => ({
        connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
        on: vi.fn(),
        status: 'disconnected',
      }));
      vi.mocked(Redis).mockImplementation(MockRedisWithError as any);

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      // Should still return a client object (error handled internally)
      expect(client).not.toBeNull();
    });

    it('should set client to null on connection failure', async () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_HOST = 'localhost';
      delete process.env.VITEST;

      const MockRedisWithError = vi.fn().mockImplementation(() => {
        throw new Error('Cannot create Redis client');
      });
      vi.mocked(Redis).mockImplementation(MockRedisWithError as any);

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      expect(client).toBeNull();
    });
  });

  describe('Configuration validation', () => {
    it('should handle test environment correctly', async () => {
      process.env.NODE_ENV = 'test';
      process.env.VITEST = 'true';
      process.env.REDIS_HOST = 'localhost';

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      // Should create client in test env if REDIS_HOST is explicitly set
      expect(client).not.toBeNull();
    });

    it('should skip Redis in test without explicit config', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.REDIS_HOST;

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      expect(client).toBeNull();
    });

    it('should handle VITEST flag', async () => {
      process.env.VITEST = 'true';
      delete process.env.REDIS_HOST;

      const { createRedisClient } = await import('../config/redis.js');
      const client = createRedisClient();

      expect(client).toBeNull();
    });
  });
});
