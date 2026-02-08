import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database.js';
import { UserSettingsService } from '../services/user-settings.service.js';
import { generateUserBalanceEmail } from '../templates/emails/user-balance.template.js';

describe('User Statistics Email', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let userId: string;
  let userSettingsService: UserSettingsService;

  beforeAll(async () => {
    app = await buildApp();
    userSettingsService = new UserSettingsService();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database
    await AppDataSource.getRepository('UserSettings').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('Balance').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('TimeLog').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('Timer').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('Target').createQueryBuilder().delete().execute();
    await AppDataSource.getRepository('User').createQueryBuilder().delete().execute();

    // Register and login
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'stats@test.com',
        password: 'password123',
        name: 'Stats Test',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'stats@test.com',
        password: 'password123',
      },
    });

    sessionCookie = loginResponse.headers['set-cookie'] as string;
    userId = JSON.parse(registerResponse.payload).id;
  });

  describe('Settings - statistics_email_frequency', () => {
    it('should default to none for new users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/user-settings',
        headers: { cookie: sessionCookie },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.statistics_email_frequency).toBe('none');
    });

    it('should update statistics_email_frequency to weekly', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/user-settings',
        headers: { cookie: sessionCookie },
        payload: {
          statistics_email_frequency: 'weekly',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.statistics_email_frequency).toBe('weekly');
    });

    it('should update statistics_email_frequency to monthly', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/user-settings',
        headers: { cookie: sessionCookie },
        payload: {
          statistics_email_frequency: 'monthly',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.statistics_email_frequency).toBe('monthly');
    });

    it('should persist frequency across GET requests', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/user-settings',
        headers: { cookie: sessionCookie },
        payload: {
          statistics_email_frequency: 'monthly',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/user-settings',
        headers: { cookie: sessionCookie },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.statistics_email_frequency).toBe('monthly');
    });

    it('should include frequency in sync response', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/user-settings',
        headers: { cookie: sessionCookie },
        payload: {
          statistics_email_frequency: 'weekly',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/user-settings/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.settings).toBeDefined();
      expect(data.settings.statistics_email_frequency).toBe('weekly');
    });

    it('should accept frequency in sync push', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/user-settings/sync',
        headers: { cookie: sessionCookie },
        payload: {
          settings: {
            language: 'de',
            locale: 'de-DE',
            statistics_email_frequency: 'monthly',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.settings.statistics_email_frequency).toBe('monthly');
      expect(data.settings.language).toBe('de');
      expect(data.settings.locale).toBe('de-DE');
    });
  });

  describe('getSettingsByFrequency', () => {
    it('should find users by frequency', async () => {
      // Set weekly frequency
      await userSettingsService.updateSettings(userId, {
        statistics_email_frequency: 'weekly',
      });

      const weeklySettings = await userSettingsService.getSettingsByFrequency('weekly');
      expect(weeklySettings.length).toBeGreaterThanOrEqual(1);
      expect(weeklySettings.some(s => s.user_id === userId)).toBe(true);

      const monthlySettings = await userSettingsService.getSettingsByFrequency('monthly');
      expect(monthlySettings.every(s => s.user_id !== userId)).toBe(true);
    });
  });

  describe('User Balance Email Template', () => {
    it('should generate valid HTML email with summaries (en)', () => {
      const result = generateUserBalanceEmail({
        userName: 'Test User',
        appUrl: 'https://app.example.com',
        summaries: [
          {
            targetName: 'Full Time Job',
            currentMonthDate: '2025-02',
            currentMonthDueMinutes: 9600,
            currentMonthWorkedMinutes: 8400,
            currentMonthBalance: -1200,
            cumulativeMinutes: -2400,
            sickDays: 2,
            holidays: 1,
            childSick: 0,
            workedDays: 17,
          },
        ],
        reportDate: new Date('2025-02-08'),
        locale: 'en-US',
      });

      expect(result.html).toContain('Full Time Job');
      expect(result.html).toContain('TapShift');
      expect(result.subject).toContain('TapShift');
      expect(result.text).toContain('Full Time Job');
    });

    it('should generate valid HTML email with summaries (de)', () => {
      const result = generateUserBalanceEmail({
        userName: 'Testbenutzer',
        appUrl: 'https://app.example.com',
        summaries: [
          {
            targetName: 'Vollzeit',
            currentMonthDate: '2025-02',
            currentMonthDueMinutes: 9600,
            currentMonthWorkedMinutes: 10200,
            currentMonthBalance: 600,
            cumulativeMinutes: 1200,
            sickDays: 0,
            holidays: 0,
            childSick: 0,
            workedDays: 20,
          },
        ],
        reportDate: new Date('2025-02-08'),
        locale: 'de-DE',
      });

      expect(result.html).toContain('Vollzeit');
      expect(result.html).toContain('Saldenbericht');
      expect(result.subject).toContain('Saldenbericht');
      expect(result.text).toContain('Vollzeit');
    });

    it('should handle empty summaries gracefully', () => {
      const result = generateUserBalanceEmail({
        userName: 'Test User',
        appUrl: 'https://app.example.com',
        summaries: [],
        reportDate: new Date('2025-02-08'),
        locale: 'en-US',
      });

      expect(result.html).toContain('No targets configured');
      expect(result.text).toContain('No targets configured');
    });
  });
});
