import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { UserSettingsService } from '../services/user-settings.service.js';

const userSettingsService = new UserSettingsService();

// Allowed values for validation
const ALLOWED_LANGUAGES = ['en', 'de'];
const ALLOWED_LOCALES = ['en-US', 'en-GB', 'de-DE', 'de-AT', 'de-CH'];
const ALLOWED_FREQUENCIES = ['none', 'weekly', 'monthly'];

// Reusable schema for settings response
const SettingsResponseSchema = Type.Object({
  id: Type.String(),
  user_id: Type.String(),
  language: Type.String(),
  locale: Type.String(),
  statistics_email_frequency: Type.String(),
  created_at: Type.String(),
  updated_at: Type.String(),
});

function settingsToResponse(settings: any) {
  return {
    id: settings.id,
    user_id: settings.user_id,
    language: settings.language,
    locale: settings.locale,
    statistics_email_frequency: settings.statistics_email_frequency,
    created_at: settings.created_at.toISOString(),
    updated_at: settings.updated_at.toISOString(),
  };
}

export async function userSettingsRoutes(fastify: FastifyInstance) {
  // Get user settings
  fastify.get('/', {
    schema: {
      tags: ['User Settings'],
      response: {
        200: SettingsResponseSchema,
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
    
    return reply.send(settingsToResponse(settings));
  });

  // Update user settings
  fastify.put('/', {
    schema: {
      tags: ['User Settings'],
      body: Type.Object({
        language: Type.Optional(Type.Union([Type.Literal('en'), Type.Literal('de')])),
        locale: Type.Optional(Type.Union([
          Type.Literal('en-US'),
          Type.Literal('en-GB'),
          Type.Literal('de-DE'),
          Type.Literal('de-AT'),
          Type.Literal('de-CH'),
        ])),
        statistics_email_frequency: Type.Optional(Type.Union([
          Type.Literal('none'),
          Type.Literal('weekly'),
          Type.Literal('monthly'),
        ])),
      }),
      response: {
        200: SettingsResponseSchema,
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

    const { language, locale, statistics_email_frequency } = request.body as any;
    const settings = await userSettingsService.updateSettings(userId, { language, locale, statistics_email_frequency });
    
    return reply.send(settingsToResponse(settings));
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
          settings: Type.Optional(SettingsResponseSchema),
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
      settings: settings ? settingsToResponse(settings) : undefined,
      cursor: new Date().toISOString(),
    });
  });

  // Sync endpoint - POST push changes
  fastify.post('/sync', {
    schema: {
      tags: ['User Settings'],
      body: Type.Object({
        settings: Type.Object({
          language: Type.Optional(Type.Union([Type.Literal('en'), Type.Literal('de')])),
          locale: Type.Optional(Type.Union([
            Type.Literal('en-US'),
            Type.Literal('en-GB'),
            Type.Literal('de-DE'),
            Type.Literal('de-AT'),
            Type.Literal('de-CH'),
          ])),
          statistics_email_frequency: Type.Optional(Type.Union([
            Type.Literal('none'),
            Type.Literal('weekly'),
            Type.Literal('monthly'),
          ])),
          updated_at: Type.Optional(Type.String()),
        }),
      }),
      response: {
        200: Type.Object({
          settings: SettingsResponseSchema,
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
      settings: settingsToResponse(result.settings),
      conflict: result.conflict,
      cursor: new Date().toISOString(),
    });
  });
}
