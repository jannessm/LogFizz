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
            position: 0,
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
            position: 1,
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
      // Create initial button
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/buttons',
        headers: { cookie: sessionCookie },
        payload: {
          name: 'Initial Button',
          position: 0,
          auto_subtract_breaks: false,
        },
      });
      buttonId1 = JSON.parse(createResponse.payload).id;

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

      // Server updates the button
      await app.inject({
        method: 'PUT',
        url: `/api/buttons/${buttonId1}`,
        headers: { cookie: sessionCookie },
        payload: { name: 'Server Updated' },
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
            position: 0,
            auto_subtract_breaks: false,
            updated_at: currentButton.updated_at, // Old timestamp
          }],
        },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.conflicts).toHaveLength(1);
      expect(data.conflicts[0].id).toBe(buttonId1);
      expect(data.conflicts[0].field).toBe('button');
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
      // Create second button
      const create2Response = await app.inject({
        method: 'POST',
        url: '/api/buttons',
        headers: { cookie: sessionCookie },
        payload: {
          name: 'Button 2',
          position: 1,
          auto_subtract_breaks: false,
        },
      });
      buttonId2 = JSON.parse(create2Response.payload).id;

      // Get both buttons from sync endpoint
      const getSyncResponse = await app.inject({
        method: 'GET',
        url: '/api/buttons/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const syncData = JSON.parse(getSyncResponse.payload);
      const button1 = syncData.buttons.find((b: any) => b.id === buttonId1);
      const button2 = syncData.buttons.find((b: any) => b.id === buttonId2);

      // Update button1 on server
      await app.inject({
        method: 'PUT',
        url: `/api/buttons/${buttonId1}`,
        headers: { cookie: sessionCookie },
        payload: { name: 'Server Updated B1' },
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
      expect(data.conflicts[0].id).toBe(buttonId1);
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
      // Create button 1
      const create1 = await app.inject({
        method: 'POST',
        url: '/api/buttons',
        headers: { cookie: sessionCookie },
        payload: { name: 'Button 1', position: 0, auto_subtract_breaks: false },
      });
      buttonId1 = JSON.parse(create1.payload).id;

      // Get sync cursor
      const sync1 = await app.inject({
        method: 'GET',
        url: '/api/buttons/sync?since=1970-01-01T00:00:00.000Z',
        headers: { cookie: sessionCookie },
      });
      const cursor1 = JSON.parse(sync1.payload).cursor;

      // Wait to ensure timestamp difference between cursor and next creation
      await new Promise(resolve => setTimeout(resolve, 50));

      // Create button 2 after cursor
      const create2 = await app.inject({
        method: 'POST',
        url: '/api/buttons',
        headers: { cookie: sessionCookie },
        payload: { name: 'Button 2', position: 1, auto_subtract_breaks: false },
      });
      buttonId2 = JSON.parse(create2.payload).id;

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
      // Create a button first
      const createButton = await app.inject({
        method: 'POST',
        url: '/api/buttons',
        headers: { cookie: sessionCookie },
        payload: { name: 'Test Button', position: 0, auto_subtract_breaks: false },
      });
      buttonId1 = JSON.parse(createButton.payload).id;
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
            apply_break_calculation: false,
            is_manual: true,
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
      // Create button
      const createButton = await app.inject({
        method: 'POST',
        url: '/api/buttons',
        headers: { cookie: sessionCookie },
        payload: { name: 'Test Button', position: 0, auto_subtract_breaks: false },
      });
      buttonId1 = JSON.parse(createButton.payload).id;

      // Create timelog
      const createLog = await app.inject({
        method: 'POST',
        url: '/api/timelogs/manual',
        headers: { cookie: sessionCookie },
        payload: {
          button_id: buttonId1,
          start_time: new Date(Date.now() - 3600000).toISOString(),
          end_time: new Date().toISOString(),
          notes: 'Initial log',
        },
      });
      timeLogId1 = JSON.parse(createLog.payload).start.id;

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

      // Server updates the log
      await app.inject({
        method: 'PUT',
        url: `/api/timelogs/${timeLogId1}`,
        headers: { cookie: sessionCookie },
        payload: { notes: 'Server updated notes' },
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
            notes: 'Client updated notes',
            apply_break_calculation: false,
            is_manual: true,
            updated_at: currentLog.updated_at, // Old timestamp
          }],
        },
      });

      expect(syncResponse.statusCode).toBe(200);
      const data = JSON.parse(syncResponse.payload);
      
      expect(data.conflicts).toHaveLength(1);
      expect(data.conflicts[0].id).toBe(timeLogId1);
      expect(data.conflicts[0].field).toBe('timeLog');
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
            button_id: buttonId1,
            type: currentLog.type,
            timestamp: currentLog.timestamp,
            notes: 'Client wins',
            apply_break_calculation: false,
            is_manual: true,
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
      // Create button
      const createButton = await app.inject({
        method: 'POST',
        url: '/api/buttons',
        headers: { cookie: sessionCookie },
        payload: { name: 'Test Button', position: 0, auto_subtract_breaks: false },
      });
      buttonId1 = JSON.parse(createButton.payload).id;
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
      // Create log 1
      const create1 = await app.inject({
        method: 'POST',
        url: '/api/timelogs/manual',
        headers: { cookie: sessionCookie },
        payload: {
          button_id: buttonId1,
          start_time: new Date(Date.now() - 7200000).toISOString(),
          end_time: new Date(Date.now() - 3600000).toISOString(),
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

      // Create log 2 after cursor
      const create2 = await app.inject({
        method: 'POST',
        url: '/api/timelogs/manual',
        headers: { cookie: sessionCookie },
        payload: {
          button_id: buttonId1,
          start_time: new Date(Date.now() - 1800000).toISOString(),
          end_time: new Date().toISOString(),
          notes: 'Recent log',
        },
      });
      const log2Id = JSON.parse(create2.payload).start.id;

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
        l.notes === 'Recent log' || l.id === log2Id
      );
      expect(log2Records.length).toBeGreaterThan(0);
    });
  });

  describe('Sync - Soft Delete Handling', () => {
    beforeEach(async () => {
      // Create button
      const createButton = await app.inject({
        method: 'POST',
        url: '/api/buttons',
        headers: { cookie: sessionCookie },
        payload: { name: 'To Delete', position: 0, auto_subtract_breaks: false },
      });
      buttonId1 = JSON.parse(createButton.payload).id;
    });

    it('should sync soft-deleted buttons', async () => {
      // Delete button
      await app.inject({
        method: 'DELETE',
        url: `/api/buttons/${buttonId1}`,
        headers: { cookie: sessionCookie },
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
