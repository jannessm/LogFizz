import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database.js';
import { registerAndAuthenticate } from './testHelpers.js';

describe('Sync API - Offline-First', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let userId: string;
  let timerId1: string;
  let timerId2: string;
  let timeLogId1: string;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database - delete in order to respect foreign key constraints
    await AppDataSource.getRepository('TimeLog').deleteAll();
    await AppDataSource.getRepository('Timer').deleteAll();
    await AppDataSource.getRepository('User').deleteAll();

    // Register and authenticate via magic link
    const result = await registerAndAuthenticate(app, {
      email: 'sync@test.com',
      name: 'Sync Test',
    });

    sessionCookie = result.authCookie;
    userId = result.userId;
  });

  describe('Timer Sync - Client-Side UUID Generation', () => {
    it('should accept client-generated UUID for new timer', async () => {
      const clientUUID = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: clientUUID,
            name: 'Client Timer',
            auto_subtract_breaks: false,
          }],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].id).toBe(clientUUID);
      expect(data.saved[0].name).toBe('Client Timer');
      expect(data.cursor).toBeDefined();
    });

    it('should create timer with client UUID if not exists', async () => {
      const clientUUID = '660e8400-e29b-41d4-a716-446655440001';
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: clientUUID,
            name: 'Offline Created',
            auto_subtract_breaks: true,
            emoji: '🔥',
          }],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.saved[0].id).toBe(clientUUID);
      expect(data.saved[0].emoji).toBe('🔥');
    });
  });

  describe('Timer Sync - Conflict Detection', () => {
    beforeEach(async () => {
      // Create initial timer via sync
      timerId1 = '550e8400-e29b-41d4-a716-446655441111';
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId1,
            name: 'Initial Timer',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should detect conflict when server is newer', async () => {
      // Get current timer with timestamp from sync endpoint
      const getSyncResponse = await app.inject({
        method: 'GET',
        url: '/api/timers/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const syncData = JSON.parse(getSyncResponse.payload);
      const currentTimer = syncData.timers.find((t: any) => t.id === timerId1);

      // Server updates the timer via sync
      await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId1,
            name: 'Server Updated',
            auto_subtract_breaks: false,
          }],
        },
      });

      // Wait for timestamp to be different (SQLite needs more time than PostgreSQL)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Client tries to update with old timestamp
      const syncResponse = await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId1,
            name: 'Client Updated',
            auto_subtract_breaks: false,
            updated_at: currentTimer.updated_at, // Old timestamp
          }],
        },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.conflicts).toHaveLength(1);
      expect(data.conflicts[0].clientVersion.id).toBe(timerId1);
      expect(data.conflicts[0].serverVersion.id).toBe(timerId1);
      expect(data.conflicts[0].clientVersion.name).toBe('Client Updated');
      expect(data.conflicts[0].serverVersion.name).toBe('Server Updated');
      expect(data.saved).toBeUndefined();
    });

    it('should save when client is newer', async () => {
      // Get current timer from sync endpoint
      const getSyncResponse = await app.inject({
        method: 'GET',
        url: '/api/timers/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const syncData = JSON.parse(getSyncResponse.payload);
      const currentTimer = syncData.timers.find((t: any) => t.id === timerId1);

      // Wait to ensure newer timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      // Client updates with newer timestamp
      const futureDate = new Date(Date.now() + 1000).toISOString();
      const syncResponse = await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId1,
            name: 'Client Wins',
            position: 0,
            auto_subtract_breaks: false,
            updated_at: futureDate,
          }],
        },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].name).toBe('Client Wins');
      expect(data.conflicts).toBeUndefined();
    });

    it('should save when no updated_at provided (no conflict check)', async () => {
      const syncResponse = await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId1,
            name: 'No Timestamp Update',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].name).toBe('No Timestamp Update');
    });

    it('should handle multiple timers with mixed conflicts', async () => {
      // Create second timer via sync
      timerId2 = '550e8400-e29b-41d4-a716-446655442222';
      await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId2,
            name: 'Timer 2',
            position: 1,
            auto_subtract_breaks: false,
          }],
        },
      });

      // Get both timers from sync endpoint
      const getSyncResponse = await app.inject({
        method: 'GET',
        url: '/api/timers/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const syncData = JSON.parse(getSyncResponse.payload);
      const timer1 = syncData.timers.find((t: any) => t.id === timerId1);
      const timer2 = syncData.timers.find((t: any) => t.id === timerId2);

      // Update timer1 on server via sync
      await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId1,
            name: 'Server Updated T1',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Client tries to sync both: timer1 has conflict, timer2 succeeds
      const syncResponse = await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [
            {
              id: timerId1,
              name: 'Client Updated T1',
              position: 0,
              auto_subtract_breaks: false,
              updated_at: timer1.updated_at,
            },
            {
              id: timerId2,
              name: 'Client Updated T2',
              position: 1,
              auto_subtract_breaks: true,
              updated_at: timer2.updated_at,
            },
          ],
        },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.conflicts).toHaveLength(1);
      expect(data.conflicts[0].clientVersion.id).toBe(timerId1);
      expect(data.conflicts[0].serverVersion.id).toBe(timerId1);
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].id).toBe(timerId2);
      expect(data.saved[0].name).toBe('Client Updated T2');
    });
  });

  describe('Timer Sync - Cursor-Based Sync', () => {
    it('should return cursor in GET sync response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/timers/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.cursor).toBeDefined();
      expect(new Date(data.cursor).getTime()).toBeGreaterThan(0);
    });

    it('should return cursor in POST sync response', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: '770e8400-e29b-41d4-a716-446655440000',
            name: 'Test Timer',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.cursor).toBeDefined();
      expect(new Date(data.cursor).getTime()).toBeGreaterThan(0);
    });

    it('should return only changed timers since cursor', async () => {
      // Create timer 1 via sync
      timerId1 = '550e8400-e29b-41d4-a716-446655443333';
      await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId1,
            name: 'Timer 1',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });

      // Get sync cursor
      const sync1 = await app.inject({
        method: 'GET',
        url: '/api/timers/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const cursor1 = JSON.parse(sync1.payload).cursor;

      // Wait to ensure timestamp difference between cursor and next creation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Create timer 2 after cursor via sync
      timerId2 = '550e8400-e29b-41d4-a716-446655444444';
      await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId2,
            name: 'Timer 2',
            position: 1,
            auto_subtract_breaks: false,
          }],
        },
      });

      // Sync with cursor - should only return timer 2
      const sync2 = await app.inject({
        method: 'GET',
        url: `/api/timers/sync?since=${encodeURIComponent(cursor1)}`,
        headers: { cookie: sessionCookie },
      });

      expect(sync2.statusCode).toBe(200);
      const data = JSON.parse(sync2.payload);
      
      expect(data.timers).toHaveLength(1);
      expect(data.timers[0].id).toBe(timerId2);
      expect(data.timers[0].name).toBe('Timer 2');
    });
  });

  describe('TimeLog Sync - Client-Side UUID Generation', () => {
    beforeEach(async () => {
      // Create a timer via sync
      timerId1 = '550e8400-e29b-41d4-a716-446655448888';
      await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId1,
            name: 'Test Timer',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });
    });

    it('should accept client-generated UUID for new timelog', async () => {
      const clientUUID = '880e8400-e29b-41d4-a716-446655440000';
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [{
            id: clientUUID,
            timer_id: timerId1,
            start_timestamp: new Date().toISOString(),
            timezone: 'Europe/Berlin',
          }],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].id).toBe(clientUUID);
      expect(data.saved[0].start_timestamp).toBeDefined();
      expect(data.cursor).toBeDefined();
    });
  });

  describe('TimeLog Sync - Conflict Detection', () => {
    beforeEach(async () => {
      // Create timer via sync
      timerId1 = '550e8400-e29b-41d4-a716-446655445555';
      await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId1,
            name: 'Test Timer',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });

      // Create timelog via sync (single log with start and end)
      timeLogId1 = '660e8400-e29b-41d4-a716-446655440001';
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: timeLogId1,
              timer_id: timerId1,
              start_timestamp: new Date(Date.now() - 3600000).toISOString(),
              end_timestamp: new Date().toISOString(),
              timezone: 'Europe/Berlin',
              notes: 'Initial log',
            },
          ],
        },
      });

      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should detect conflict when server timelog is newer', async () => {
      // Get current timelog
      const getSync = await app.inject({
        method: 'GET',
        url: '/api/timelogs/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const logs = JSON.parse(getSync.payload).timeLogs;
      const currentLog = logs.find((l: any) => l.id === timeLogId1);

      // Server updates the log via sync
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [{
            id: timeLogId1,
            timer_id: timerId1,
            start_timestamp: currentLog.start_timestamp,
            end_timestamp: currentLog.end_timestamp,
            timezone: currentLog.timezone,
            notes: 'Server updated notes',
          }],
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Client tries to update with old timestamp
      const syncResponse = await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [{
            id: timeLogId1,
            timer_id: timerId1,
            start_timestamp: currentLog.start_timestamp,
            end_timestamp: currentLog.end_timestamp,
            timezone: currentLog.timezone,
            notes: 'Client updated notes',
            updated_at: currentLog.updated_at, // Old timestamp
          }],
        },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.conflicts).toHaveLength(1);
      expect(data.conflicts[0].clientVersion.id).toBe(timeLogId1);
      expect(data.conflicts[0].serverVersion.id).toBe(timeLogId1);
      expect(data.conflicts[0].clientVersion.notes).toBe('Client updated notes');
      expect(data.conflicts[0].serverVersion.notes).toBe('Server updated notes');
    });

    it('should save when client timelog is newer', async () => {
      // Get current timelog
      const getSync = await app.inject({
        method: 'GET',
        url: '/api/timelogs/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const logs = JSON.parse(getSync.payload).timeLogs;
      const currentLog = logs.find((l: any) => l.id === timeLogId1);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Client updates with future timestamp
      const futureDate = new Date(Date.now() + 1000).toISOString();
      const syncResponse = await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [{
            id: timeLogId1,
            timer_id: timerId1,
            start_timestamp: currentLog.start_timestamp,
            end_timestamp: currentLog.end_timestamp,
            timezone: currentLog.timezone,
            notes: 'Client wins',
            updated_at: futureDate,
          }],
        },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].notes).toBe('Client wins');
      expect(data.conflicts).toBeUndefined();
    });
  });

  describe('TimeLog Sync - Cursor-Based Sync', () => {
    beforeEach(async () => {
      // Create timer via sync
      timerId1 = '550e8400-e29b-41d4-a716-446655446666';
      await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId1,
            name: 'Test Timer',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });
    });

    it('should return cursor in GET sync response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/timelogs/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.cursor).toBeDefined();
      expect(new Date(data.cursor).getTime()).toBeGreaterThan(0);
    });

    it('should return only changed timelogs since cursor', async () => {
      // Create log 1 via sync (single log with start and end)
      const log1Id = '660e8400-e29b-41d4-a716-446655440011';
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: log1Id,
              timer_id: timerId1,
              start_timestamp: new Date(Date.now() - 7200000).toISOString(),
              end_timestamp: new Date(Date.now() - 3600000).toISOString(),
              timezone: 'Europe/Berlin',
            },
          ],
        },
      });

      // Get sync cursor
      const sync1 = await app.inject({
        method: 'GET',
        url: '/api/timelogs/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const cursor1 = JSON.parse(sync1.payload).cursor;

      // Wait to ensure timestamp difference between cursor and next creation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Create log 2 after cursor via sync
      const log2Id = '660e8400-e29b-41d4-a716-446655440013';
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: log2Id,
              timer_id: timerId1,
              start_timestamp: new Date(Date.now() - 1800000).toISOString(),
              end_timestamp: new Date().toISOString(),
              timezone: 'Europe/Berlin',
              notes: 'Recent log',
            },
          ],
        },
      });

      // Sync with cursor - should only include log 2 records
      const sync2 = await app.inject({
        method: 'GET',
        url: `/api/timelogs/sync?since=${encodeURIComponent(cursor1)}`,
        headers: { cookie: sessionCookie },
      });

      expect(sync2.statusCode).toBe(200);
      const data = JSON.parse(sync2.payload);
      
      // Should have log 2
      expect(data.timeLogs.length).toBeGreaterThan(0);
      const log2Records = data.timeLogs.filter((l: any) => 
        l.notes === 'Recent log' || l.id === log2Id
      );
      expect(log2Records.length).toBeGreaterThan(0);
    });
  });

  describe('Sync - Soft Delete Handling', () => {
    beforeEach(async () => {
      // Create timer via sync
      timerId1 = '550e8400-e29b-41d4-a716-446655447777';
      await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId1,
            name: 'To Delete',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });
    });

    it('should sync soft-deleted timers', async () => {
      // Delete timer via sync (set deleted_at)
      await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: timerId1,
            name: 'To Delete',
            position: 0,
            auto_subtract_breaks: false,
            deleted_at: new Date().toISOString(),
          }],
        },
      });

      // Sync should include deleted timer
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/timers/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      const deletedTimer = data.timers.find((t: any) => t.id === timerId1);
      expect(deletedTimer).toBeDefined();
      expect(deletedTimer.deleted_at).toBeDefined();
      expect(deletedTimer.deleted_at).not.toBeNull();
    });

    it('should accept soft-deleted timer from client', async () => {
      const clientUUID = '990e8400-e29b-41d4-a716-446655440000';
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: clientUUID,
            name: 'Deleted on Client',
            position: 0,
            auto_subtract_breaks: false,
            deleted_at: new Date().toISOString(),
          }],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].deleted_at).toBeDefined();
    });
  });

  describe('Sync - Error Handling', () => {
    it('should return 400 for invalid timestamp format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/timers/sync?since=invalid-date',
        headers: { cookie: sessionCookie },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.error).toBeDefined();
    });

    it('should require authentication for sync', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/timers/sync?since=1970-01-01T00:00:00.000Z',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate required fields in sync POST', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/timers/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timers: [{
            id: '123e4567-e89b-12d3-a456-426614174000',
            // Missing required field: name
            position: 0,
          }],
        },
      });

      // Schema validation should fail
      expect(response.statusCode).toBe(400);
    });
  });
});
