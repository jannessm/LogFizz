import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { UserSettingsService } from '../services/user-settings.service.js';

const userSettingsService = new UserSettingsService();

export async function userSettingsRoutes(fastify: FastifyInstance) {
  // Get user settings
  fastify.get('/', {
    schema: {
      tags: ['User Settings'],
      response: {
        200: Type.Object({
          id: Type.String(),
          user_id: Type.String(),
          language: Type.String(),
          locale: Type.String(),
          created_at: Type.String(),
          updated_at: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    
    if (!userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    const settings = await userSettingsService.getOrCreateSettings(userId);
    
    return reply.send({
      id: settings.id,
      user_id: settings.user_id,
      language: settings.language,
      locale: settings.locale,
      created_at: settings.created_at.toISOString(),
      updated_at: settings.updated_at.toISOString(),
    });
  });

  // Update user settings
  fastify.put('/', {
    schema: {
      tags: ['User Settings'],
      body: Type.Object({
        language: Type.Optional(Type.String()),
        locale: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          user_id: Type.String(),
          language: Type.String(),
          locale: Type.String(),
          created_at: Type.String(),
          updated_at: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    
    if (!userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    const { language, locale } = request.body as any;
    const settings = await userSettingsService.updateSettings(userId, { language, locale });
    
    return reply.send({
      id: settings.id,
      user_id: settings.user_id,
      language: settings.language,
      locale: settings.locale,
      created_at: settings.created_at.toISOString(),
      updated_at: settings.updated_at.toISOString(),
    });
  });

  // Sync endpoint - GET changes since timestamp
  fastify.get('/sync', {
    schema: {
      tags: ['User Settings'],
      querystring: Type.Object({
        since: Type.String(),
      }),
      response: {
        200: Type.Object({
          settings: Type.Optional(Type.Object({
            id: Type.String(),
            user_id: Type.String(),
            language: Type.String(),
            locale: Type.String(),
            created_at: Type.String(),
            updated_at: Type.String(),
          })),
          cursor: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    
    if (!userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    const { since } = request.query as any;
    const settings = await userSettingsService.getSyncChanges(userId, since);
    
    return reply.send({
      settings: settings ? {
        id: settings.id,
        user_id: settings.user_id,
        language: settings.language,
        locale: settings.locale,
        created_at: settings.created_at.toISOString(),
        updated_at: settings.updated_at.toISOString(),
      } : undefined,
      cursor: new Date().toISOString(),
    });
  });

  // Sync endpoint - POST push changes
  fastify.post('/sync', {
    schema: {
      tags: ['User Settings'],
      body: Type.Object({
        settings: Type.Object({
          language: Type.Optional(Type.String()),
          locale: Type.Optional(Type.String()),
          updated_at: Type.Optional(Type.String()),
        }),
      }),
      response: {
        200: Type.Object({
          settings: Type.Object({
            id: Type.String(),
            user_id: Type.String(),
            language: Type.String(),
            locale: Type.String(),
            created_at: Type.String(),
            updated_at: Type.String(),
          }),
          conflict: Type.Optional(Type.Boolean()),
          cursor: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    
    if (!userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    const { settings: clientSettings } = request.body as any;
    const result = await userSettingsService.pushSyncChanges(userId, clientSettings);
    
    return reply.send({
      settings: {
        id: result.settings.id,
        user_id: result.settings.user_id,
        language: result.settings.language,
        locale: result.settings.locale,
        created_at: result.settings.created_at.toISOString(),
        updated_at: result.settings.updated_at.toISOString(),
      },
      conflict: result.conflict,
      cursor: new Date().toISOString(),
    });
  });
}
