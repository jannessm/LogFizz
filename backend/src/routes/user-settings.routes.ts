import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { UserSettingsService } from '../services/user-settings.service.js';

const userSettingsService = new UserSettingsService();

// Allowed values for validation
const ALLOWED_LANGUAGES = ['en', 'de'];
const ALLOWED_LOCALES = ['en-US', 'en-GB', 'de-DE', 'de-AT', 'de-CH'];
const ALLOWED_FIRST_DAYS = ['sunday', 'monday'];
const ALLOWED_STATS_MAIL_FREQUENCIES = ['never', 'weekly', 'monthly'];

/** Reusable TypeBox schema for a full settings response object */
const settingsResponseSchema = Type.Object({
  id: Type.String(),
  user_id: Type.String(),
  language: Type.String(),
  locale: Type.String(),
  first_day_of_week: Type.String(),
  stats_mail_frequency: Type.String(),
  created_at: Type.String(),
  updated_at: Type.String(),
});

/** Helper: map an entity to the response shape */
function toResponse(settings: any) {
  return {
    id: settings.id,
    user_id: settings.user_id,
    language: settings.language,
    locale: settings.locale,
    first_day_of_week: settings.first_day_of_week,
    stats_mail_frequency: settings.stats_mail_frequency,
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
        200: settingsResponseSchema,
        401: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const settings = await userSettingsService.getOrCreateSettings(userId);
    return reply.send(toResponse(settings));
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
        first_day_of_week: Type.Optional(Type.Union([
          Type.Literal('sunday'),
          Type.Literal('monday'),
        ])),
        stats_mail_frequency: Type.Optional(Type.Union([
          Type.Literal('never'),
          Type.Literal('weekly'),
          Type.Literal('monthly'),
        ])),
      }),
      response: {
        200: settingsResponseSchema,
        401: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const { language, locale, first_day_of_week, stats_mail_frequency } = request.body as any;
    const settings = await userSettingsService.updateSettings(userId, {
      language,
      locale,
      first_day_of_week,
      stats_mail_frequency,
    });
    return reply.send(toResponse(settings));
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
          settings: Type.Optional(settingsResponseSchema),
          cursor: Type.String(),
        }),
        401: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const { since } = request.query as any;
    const settings = await userSettingsService.getSyncChanges(userId, since);

    return reply.send({
      settings: settings ? toResponse(settings) : undefined,
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
          first_day_of_week: Type.Optional(Type.Union([
            Type.Literal('sunday'),
            Type.Literal('monday'),
          ])),
          stats_mail_frequency: Type.Optional(Type.Union([
            Type.Literal('never'),
            Type.Literal('weekly'),
            Type.Literal('monthly'),
          ])),
          updated_at: Type.Optional(Type.String()),
        }),
      }),
      response: {
        200: Type.Object({
          settings: settingsResponseSchema,
          conflict: Type.Optional(Type.Boolean()),
          cursor: Type.String(),
        }),
        401: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const { settings: clientSettings } = request.body as any;
    const result = await userSettingsService.pushSyncChanges(userId, clientSettings);

    return reply.send({
      settings: toResponse(result.settings),
      conflict: result.conflict,
      cursor: new Date().toISOString(),
    });
  });
}
