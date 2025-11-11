import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * Rate limiting configuration for authentication endpoints
 * 
 * Limits:
 * - Login/Register: 5 requests per minute per IP (1000 in test mode, unless TEST_RATE_LIMIT=strict)
 * - Password reset requests: 3 requests per 15 minutes per IP (1000 in test mode, unless TEST_RATE_LIMIT=strict)
 * - General auth endpoints: 10 requests per minute per IP (1000 in test mode, unless TEST_RATE_LIMIT=strict)
 * 
 * Use TEST_RATE_LIMIT=strict environment variable to enable actual rate limiting in tests
 */

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const isStrictRateLimitTest = process.env.TEST_RATE_LIMIT === 'strict';

// In test mode, use lenient limits unless explicitly testing rate limiting
const useProductionLimits = !isTest || isStrictRateLimitTest;

export async function registerRateLimit(fastify: FastifyInstance) {
  // Register the rate limit plugin globally
  await fastify.register(rateLimit, {
    global: false, // Don't apply to all routes, we'll use route-specific limits
    max: 100, // Default max requests
    timeWindow: '1 minute',
  });
}

/**
 * Rate limit configuration for login and register endpoints
 * Stricter limits to prevent brute force attacks
 */
export const authRateLimit = {
  config: {
    rateLimit: {
      max: useProductionLimits ? 5 : 1000,
      timeWindow: '1 minute',
    },
  },
};

/**
 * Rate limit configuration for password reset endpoints
 * Even stricter to prevent abuse
 */
export const passwordResetRateLimit = {
  config: {
    rateLimit: {
      max: useProductionLimits ? 3 : 1000,
      timeWindow: useProductionLimits ? '15 minutes' : '1 minute',
    },
  },
};

/**
 * Rate limit configuration for general authenticated endpoints
 * More lenient for authenticated users
 */
export const generalAuthRateLimit = {
  config: {
    rateLimit: {
      max: useProductionLimits ? 10 : 1000,
      timeWindow: '1 minute',
    },
  },
};
