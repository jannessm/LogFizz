import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('TimeLog Sync Routes', () => {
  let app: FastifyInstance;
  let authCookie: string;
  let userId: string;
  let buttonId: string;

  beforeAll(async () => {
    app = await buildApp();

    const email = `timelogtest${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'testpassword123',
        name: 'TimeLog Test User',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email,
        password: 'testpassword123',
      },
    });

    authCookie = loginResponse.headers['set-cookie'] as string;
    userId = JSON.parse(loginResponse.body).id;

    buttonId = '550e8400-e29b-41d4-a716-446655440000';
    await app.inject({
      method: 'POST',
      url: '/api/buttons/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        buttons: [{
          id: buttonId,
          name: 'Work',
          auto_subtract_breaks: false,
        }],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a new time log via sync', async () => {
    const timeLogId = '660e8400-e29b-41d4-a716-446655440001';
    const startTimestamp = new Date().toISOString();
    
    const response = await app.inject({
      method: 'POST',
      url: '/api/timelogs/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timeLogs: [{
          id: timeLogId,
          button_id: buttonId,
          start_timestamp: startTimestamp,
          timezone: 'Europe/Berlin',
          notes: 'Starting work session',
        }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].id).toBe(timeLogId);
    expect(body.saved[0].button_id).toBe(buttonId);
    expect(body.saved[0].start_timestamp).toBeDefined();
    expect(body.saved[0].timezone).toBe('Europe/Berlin');
    expect(body.saved[0].notes).toBe('Starting work session');
  });

  it('should get all user time logs via sync', async () => {
    const timeLogId = '770e8400-e29b-41d4-a716-446655440002';
    const startTime = new Date(Date.now() - 3600000).toISOString();
    const endTime = new Date().toISOString();
    
    await app.inject({
      method: 'POST',
      url: '/api/timelogs/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timeLogs: [{
          id: timeLogId,
          button_id: buttonId,
          start_timestamp: startTime,
          end_timestamp: endTime,
          timezone: 'Europe/Berlin',
        }],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/timelogs/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.timeLogs)).toBe(true);
    expect(body.timeLogs.length).toBeGreaterThan(0);
    expect(body.cursor).toBeDefined();
  });

  it('should update a time log via sync', async () => {
    const timeLogId = '880e8400-e29b-41d4-a716-446655440003';
    const startTimestamp = new Date(Date.now() - 3600000).toISOString();
    
    await app.inject({
      method: 'POST',
      url: '/api/timelogs/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timeLogs: [{
          id: timeLogId,
          button_id: buttonId,
          start_timestamp: startTimestamp,
          timezone: 'Europe/Berlin',
          notes: 'Initial notes',
        }],
      },
    });

    const updateResponse = await app.inject({
      method: 'POST',
      url: '/api/timelogs/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timeLogs: [{
          id: timeLogId,
          button_id: buttonId,
          start_timestamp: startTimestamp,
          timezone: 'Europe/Berlin',
          notes: 'Updated notes',
        }],
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const body = JSON.parse(updateResponse.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].notes).toBe('Updated notes');
  });

  it('should soft delete a time log via sync', async () => {
    const timeLogId = '990e8400-e29b-41d4-a716-446655440004';
    const startTimestamp = new Date().toISOString();
    
    await app.inject({
      method: 'POST',
      url: '/api/timelogs/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timeLogs: [{
          id: timeLogId,
          button_id: buttonId,
          start_timestamp: startTimestamp,
          timezone: 'Europe/Berlin',
          notes: 'To be deleted',
        }],
      },
    });

    const deleteResponse = await app.inject({
      method: 'POST',
      url: '/api/timelogs/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timeLogs: [{
          id: timeLogId,
          button_id: buttonId,
          start_timestamp: startTimestamp,
          timezone: 'Europe/Berlin',
          notes: 'To be deleted',
          deleted_at: new Date().toISOString(),
        }],
      },
    });

    expect(deleteResponse.statusCode).toBe(200);
    const body = JSON.parse(deleteResponse.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].deleted_at).toBeDefined();

    const syncResponse = await app.inject({
      method: 'GET',
      url: '/api/timelogs/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });

    const syncBody = JSON.parse(syncResponse.body);
    const deletedLog = syncBody.timeLogs.find((l: any) => l.id === timeLogId);
    expect(deletedLog).toBeDefined();
    expect(deletedLog.deleted_at).toBeDefined();
  });

  it('should not allow unauthenticated requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/timelogs/sync?since=1970-01-01T00:00:00.000Z',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should handle time log with start and end timestamps', async () => {
    const timeLogId = 'aa0e8400-e29b-41d4-a716-446655440005';
    const startTime = new Date(Date.now() - 7200000).toISOString();
    const endTime = new Date(Date.now() - 3600000).toISOString();

    const response = await app.inject({
      method: 'POST',
      url: '/api/timelogs/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timeLogs: [
          {
            id: timeLogId,
            button_id: buttonId,
            start_timestamp: startTime,
            end_timestamp: endTime,
            timezone: 'Europe/Berlin',
            notes: 'Work session',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.saved).toHaveLength(1);
    
    const savedLog = body.saved[0];
    expect(savedLog.start_timestamp).toBeDefined();
    expect(savedLog.end_timestamp).toBeDefined();
    expect(savedLog.duration_minutes).toBe(60); // 1 hour
    expect(savedLog.notes).toBe('Work session');
  });

  it('should return cursor for incremental sync', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/timelogs/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.cursor).toBeDefined();
    
    const cursorDate = new Date(body.cursor);
    expect(cursorDate.getTime()).toBeGreaterThan(0);
  });

  it('should sync only changed time logs since cursor', async () => {
    const sync1 = await app.inject({
      method: 'GET',
      url: '/api/timelogs/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });
    const cursor1 = JSON.parse(sync1.body).cursor;

    await new Promise(resolve => setTimeout(resolve, 50));

    const newLogId = 'cc0e8400-e29b-41d4-a716-446655440007';
    await app.inject({
      method: 'POST',
      url: '/api/timelogs/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timeLogs: [{
          id: newLogId,
          button_id: buttonId,
          start_timestamp: new Date().toISOString(),
          timezone: 'Europe/Berlin',
          notes: 'Recent log',
        }],
      },
    });

    const sync2 = await app.inject({
      method: 'GET',
      url: `/api/timelogs/sync?since=${encodeURIComponent(cursor1)}`,
      headers: {
        cookie: authCookie,
      },
    });

    expect(sync2.statusCode).toBe(200);
    const body = JSON.parse(sync2.body);
    
    const recentLog = body.timeLogs.find((l: any) => l.id === newLogId);
    expect(recentLog).toBeDefined();
    expect(recentLog.notes).toBe('Recent log');
  });

  it('should handle different timezones', async () => {
    const timeLogId = 'dd0e8400-e29b-41d4-a716-446655440008';
    
    const response = await app.inject({
      method: 'POST',
      url: '/api/timelogs/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        timeLogs: [{
          id: timeLogId,
          button_id: buttonId,
          start_timestamp: new Date().toISOString(),
          timezone: 'America/New_York',
          notes: 'US session',
        }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].timezone).toBe('America/New_York');
  });
});
