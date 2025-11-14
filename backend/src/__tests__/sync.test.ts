import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database.js';

describe('Sync API - Offline-First', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let userId: string;
  let buttonId1: string;
  let buttonId2: string;
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
    await AppDataSource.getRepository('Button').deleteAll();
    await AppDataSource.getRepository('User').deleteAll();

    // Register and login
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'sync@test.com',
        password: 'password123',
        name: 'Sync Test',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'sync@test.com',
        password: 'password123',
      },
    });

    sessionCookie = loginResponse.headers['set-cookie'] as string;
    userId = JSON.parse(registerResponse.payload).id;
  });

  describe('Button Sync - Client-Side UUID Generation', () => {
    it('should accept client-generated UUID for new button', async () => {
      const clientUUID = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: clientUUID,
            name: 'Client Button',
            auto_subtract_breaks: false,
          }],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].id).toBe(clientUUID);
      expect(data.saved[0].name).toBe('Client Button');
      expect(data.cursor).toBeDefined();
    });

    it('should create button with client UUID if not exists', async () => {
      const clientUUID = '660e8400-e29b-41d4-a716-446655440001';
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
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

  describe('Button Sync - Conflict Detection', () => {
    beforeEach(async () => {
      // Create initial button via sync
      buttonId1 = '550e8400-e29b-41d4-a716-446655441111';
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId1,
            name: 'Initial Button',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should detect conflict when server is newer', async () => {
      // Get current button with timestamp from sync endpoint
      const getSyncResponse = await app.inject({
        method: 'GET',
        url: '/api/buttons/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const syncData = JSON.parse(getSyncResponse.payload);
      const currentButton = syncData.buttons.find((b: any) => b.id === buttonId1);

      // Server updates the button via sync
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId1,
            name: 'Server Updated',
            auto_subtract_breaks: false,
          }],
        },
      });

      // Wait for timestamp to be different
      await new Promise(resolve => setTimeout(resolve, 10));

      // Client tries to update with old timestamp
      const syncResponse = await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId1,
            name: 'Client Updated',
            auto_subtract_breaks: false,
            updated_at: currentButton.updated_at, // Old timestamp
          }],
        },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.conflicts).toHaveLength(1);
      expect(data.conflicts[0].clientVersion.id).toBe(buttonId1);
      expect(data.conflicts[0].serverVersion.id).toBe(buttonId1);
      expect(data.conflicts[0].clientVersion.name).toBe('Client Updated');
      expect(data.conflicts[0].serverVersion.name).toBe('Server Updated');
      expect(data.saved).toBeUndefined();
    });

    it('should save when client is newer', async () => {
      // Get current button from sync endpoint
      const getSyncResponse = await app.inject({
        method: 'GET',
        url: '/api/buttons/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const syncData = JSON.parse(getSyncResponse.payload);
      const currentButton = syncData.buttons.find((b: any) => b.id === buttonId1);

      // Wait to ensure newer timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      // Client updates with newer timestamp
      const futureDate = new Date(Date.now() + 1000).toISOString();
      const syncResponse = await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId1,
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
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId1,
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

    it('should handle multiple buttons with mixed conflicts', async () => {
      // Create second button via sync
      buttonId2 = '550e8400-e29b-41d4-a716-446655442222';
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId2,
            name: 'Button 2',
            position: 1,
            auto_subtract_breaks: false,
          }],
        },
      });

      // Get both buttons from sync endpoint
      const getSyncResponse = await app.inject({
        method: 'GET',
        url: '/api/buttons/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const syncData = JSON.parse(getSyncResponse.payload);
      const button1 = syncData.buttons.find((b: any) => b.id === buttonId1);
      const button2 = syncData.buttons.find((b: any) => b.id === buttonId2);

      // Update button1 on server via sync
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId1,
            name: 'Server Updated B1',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Client tries to sync both: button1 has conflict, button2 succeeds
      const syncResponse = await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [
            {
              id: buttonId1,
              name: 'Client Updated B1',
              position: 0,
              auto_subtract_breaks: false,
              updated_at: button1.updated_at,
            },
            {
              id: buttonId2,
              name: 'Client Updated B2',
              position: 1,
              auto_subtract_breaks: true,
              updated_at: button2.updated_at,
            },
          ],
        },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.conflicts).toHaveLength(1);
      expect(data.conflicts[0].clientVersion.id).toBe(buttonId1);
      expect(data.conflicts[0].serverVersion.id).toBe(buttonId1);
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].id).toBe(buttonId2);
      expect(data.saved[0].name).toBe('Client Updated B2');
    });
  });

  describe('Button Sync - Cursor-Based Sync', () => {
    it('should return cursor in GET sync response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/buttons/sync?since=1970-01-01T00:00:00.000Z',
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
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: '770e8400-e29b-41d4-a716-446655440000',
            name: 'Test Button',
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

    it('should return only changed buttons since cursor', async () => {
      // Create button 1 via sync
      buttonId1 = '550e8400-e29b-41d4-a716-446655443333';
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId1,
            name: 'Button 1',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });

      // Get sync cursor
      const sync1 = await app.inject({
        method: 'GET',
        url: '/api/buttons/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const cursor1 = JSON.parse(sync1.payload).cursor;

      // Wait to ensure timestamp difference between cursor and next creation
      await new Promise(resolve => setTimeout(resolve, 50));

      // Create button 2 after cursor via sync
      buttonId2 = '550e8400-e29b-41d4-a716-446655444444';
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId2,
            name: 'Button 2',
            position: 1,
            auto_subtract_breaks: false,
          }],
        },
      });

      // Sync with cursor - should only return button 2
      const sync2 = await app.inject({
        method: 'GET',
        url: `/api/buttons/sync?since=${encodeURIComponent(cursor1)}`,
        headers: { cookie: sessionCookie },
      });

      expect(sync2.statusCode).toBe(200);
      const data = JSON.parse(sync2.payload);
      
      expect(data.buttons).toHaveLength(1);
      expect(data.buttons[0].id).toBe(buttonId2);
      expect(data.buttons[0].name).toBe('Button 2');
    });
  });

  describe('TimeLog Sync - Client-Side UUID Generation', () => {
    beforeEach(async () => {
      // Create a button via sync
      buttonId1 = '550e8400-e29b-41d4-a716-446655448888';
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId1,
            name: 'Test Button',
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
            button_id: buttonId1,
            type: 'start',
            timestamp: new Date().toISOString(),
            timezone: 'Europe/Berlin',
          }],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].id).toBe(clientUUID);
      expect(data.saved[0].type).toBe('start');
      expect(data.cursor).toBeDefined();
    });
  });

  describe('TimeLog Sync - Conflict Detection', () => {
    beforeEach(async () => {
      // Create button via sync
      buttonId1 = '550e8400-e29b-41d4-a716-446655445555';
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId1,
            name: 'Test Button',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });

      // Create timelog via sync
      timeLogId1 = '660e8400-e29b-41d4-a716-446655440001';
      const timeLogId2 = '660e8400-e29b-41d4-a716-446655440002';
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: timeLogId1,
              button_id: buttonId1,
              type: 'start',
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              timezone: 'Europe/Berlin',
              description: 'Initial log',
            },
            {
              id: timeLogId2,
              button_id: buttonId1,
              type: 'stop',
              timestamp: new Date().toISOString(),
              timezone: 'Europe/Berlin',
              description: 'Initial log',
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
            button_id: buttonId1,
            type: currentLog.type,
            timestamp: currentLog.timestamp,
            timezone: currentLog.timezone,
            description: 'Server updated notes',
          }],
        },
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Client tries to update with old timestamp
      const syncResponse = await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [{
            id: timeLogId1,
            button_id: buttonId1,
            type: currentLog.type,
            timestamp: currentLog.timestamp,
            timezone: currentLog.timezone,
            description: 'Client updated notes',
            updated_at: currentLog.updated_at, // Old timestamp
          }],
        },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.conflicts).toHaveLength(1);
      expect(data.conflicts[0].clientVersion.id).toBe(timeLogId1);
      expect(data.conflicts[0].serverVersion.id).toBe(timeLogId1);
      expect(data.conflicts[0].clientVersion.description).toBe('Client updated notes');
      expect(data.conflicts[0].serverVersion.description).toBe('Server updated notes');
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
            button_id: buttonId1,
            type: currentLog.type,
            timestamp: currentLog.timestamp,
            timezone: currentLog.timezone,
            description: 'Client wins',
            updated_at: futureDate,
          }],
        },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.saved).toHaveLength(1);
      expect(data.saved[0].description).toBe('Client wins');
      expect(data.conflicts).toBeUndefined();
    });
  });

  describe('TimeLog Sync - Cursor-Based Sync', () => {
    beforeEach(async () => {
      // Create button via sync
      buttonId1 = '550e8400-e29b-41d4-a716-446655446666';
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId1,
            name: 'Test Button',
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
      // Create log 1 via sync
      const log1StartId = '660e8400-e29b-41d4-a716-446655440011';
      const log1EndId = '660e8400-e29b-41d4-a716-446655440012';
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: log1StartId,
              button_id: buttonId1,
              type: 'start',
              timestamp: new Date(Date.now() - 7200000).toISOString(),
              timezone: 'Europe/Berlin',
            },
            {
              id: log1EndId,
              button_id: buttonId1,
              type: 'stop',
              timestamp: new Date(Date.now() - 3600000).toISOString(),
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
      await new Promise(resolve => setTimeout(resolve, 50));

      // Create log 2 after cursor via sync
      const log2StartId = '660e8400-e29b-41d4-a716-446655440013';
      const log2EndId = '660e8400-e29b-41d4-a716-446655440014';
      await app.inject({
        method: 'POST',
        url: '/api/timelogs/sync',
        headers: { cookie: sessionCookie },
        payload: {
          timeLogs: [
            {
              id: log2StartId,
              button_id: buttonId1,
              type: 'start',
              timestamp: new Date(Date.now() - 1800000).toISOString(),
              timezone: 'Europe/Berlin',
              description: 'Recent log',
            },
            {
              id: log2EndId,
              button_id: buttonId1,
              type: 'stop',
              timestamp: new Date().toISOString(),
              timezone: 'Europe/Berlin',
              description: 'Recent log',
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
      
      // Should have start and stop for log 2
      expect(data.timeLogs.length).toBeGreaterThan(0);
      const log2Records = data.timeLogs.filter((l: any) => 
        l.description === 'Recent log' || l.id === log2StartId || l.id === log2EndId
      );
      expect(log2Records.length).toBeGreaterThan(0);
    });
  });

  describe('Sync - Soft Delete Handling', () => {
    beforeEach(async () => {
      // Create button via sync
      buttonId1 = '550e8400-e29b-41d4-a716-446655447777';
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId1,
            name: 'To Delete',
            position: 0,
            auto_subtract_breaks: false,
          }],
        },
      });
    });

    it('should sync soft-deleted buttons', async () => {
      // Delete button via sync (set deleted_at)
      await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
            id: buttonId1,
            name: 'To Delete',
            position: 0,
            auto_subtract_breaks: false,
            deleted_at: new Date().toISOString(),
          }],
        },
      });

      // Sync should include deleted button
      const syncResponse = await app.inject({
        method: 'GET',
        url: '/api/buttons/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      const deletedButton = data.buttons.find((b: any) => b.id === buttonId1);
      expect(deletedButton).toBeDefined();
      expect(deletedButton.deleted_at).toBeDefined();
      expect(deletedButton.deleted_at).not.toBeNull();
    });

    it('should accept soft-deleted button from client', async () => {
      const clientUUID = '990e8400-e29b-41d4-a716-446655440000';
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
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
        url: '/api/buttons/sync?since=invalid-date',
        headers: { cookie: sessionCookie },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.error).toBeDefined();
    });

    it('should require authentication for sync', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/buttons/sync?since=1970-01-01T00:00:00.000Z',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate required fields in sync POST', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/buttons/sync',
        headers: { cookie: sessionCookie },
        payload: {
          buttons: [{
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
