import { FastifyInstance } from 'fastify';
import { User } from '../entities/User.js';

/**
 * Helper to register and authenticate a test user via magic link flow.
 * After registration, reads the magic_link_token from the DB and verifies it
 * to create an authenticated session.
 * 
 * Returns the auth cookie and user ID.
 */
export async function registerAndAuthenticate(
  app: FastifyInstance,
  options?: {
    email?: string;
    name?: string;
  }
): Promise<{ authCookie: string; userId: string; email: string }> {
  const email = options?.email || `test${Date.now()}@example.com`;
  const name = options?.name || 'Test User';

  // Step 1: Register the user
  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email,
      name,
    },
  });

  if (registerResponse.statusCode !== 201) {
    throw new Error(`Registration failed: ${registerResponse.body}`);
  }

  const registeredUser = JSON.parse(registerResponse.body);

  // Step 2: Get the magic link token from the database
  // Use the app's TypeORM connection to fetch the user
  const { AppDataSource } = await import('../config/database.js');
  const userRepository = AppDataSource.getRepository(User);
  const dbUser = await userRepository.findOne({ where: { email } });

  if (!dbUser || !dbUser.magic_link_token) {
    throw new Error('No magic link token found for user');
  }

  // Step 3: Verify the magic link to create an authenticated session
  const verifyResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/verify-magic-link',
    payload: {
      token: dbUser.magic_link_token,
    },
  });

  if (verifyResponse.statusCode !== 200) {
    throw new Error(`Magic link verification failed: ${verifyResponse.body}`);
  }

  const authCookie = verifyResponse.headers['set-cookie'] as string;
  const userId = JSON.parse(verifyResponse.body).id;

  return { authCookie, userId, email };
}
