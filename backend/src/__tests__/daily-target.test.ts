import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Daily Target Routes', () => {
  let app: FastifyInstance;
  let authCookie: string;
  let userId: string;
  let targetId: string;

  beforeAll(async () => {
    app = await buildApp();

    // Register and login a test user
    const email = `targettest${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'testpassword123',
        name: 'Target Test User',
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/targets', () => {
    it('should create a new daily target', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/targets',
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'Morning Routine',
          duration_minutes: 120,
          weekdays: [1, 2, 3, 4, 5], // Monday to Friday
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.target).toBeDefined();
      expect(body.target.name).toBe('Morning Routine');
      expect(body.target.duration_minutes).toBe(120);
      expect(body.target.weekdays).toEqual([1, 2, 3, 4, 5]);
      expect(body.target.user_id).toBe(userId);
      
      targetId = body.target.id;
    });

    it('should create a target with client-provided UUID', async () => {
      const clientId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await app.inject({
        method: 'POST',
        url: '/api/targets',
        headers: {
          cookie: authCookie,
        },
        payload: {
          id: clientId,
          name: 'Evening Routine',
          duration_minutes: 60,
          weekdays: [0, 6], // Sunday and Saturday
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.target.id).toBe(clientId);
      expect(body.target.name).toBe('Evening Routine');
    });

    it('should reject target with invalid weekdays', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/targets',
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'Invalid Target',
          duration_minutes: 60,
          weekdays: [7, 8], // Invalid weekday numbers
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject target without required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/targets',
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'Incomplete Target',
          // Missing duration_minutes and weekdays
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject target with empty weekdays array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/targets',
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'No Days Target',
          duration_minutes: 60,
          weekdays: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/targets',
        payload: {
          name: 'Unauthorized Target',
          duration_minutes: 60,
          weekdays: [1, 2, 3],
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/targets', () => {
    it('should get all user targets', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/targets',
        headers: {
          cookie: authCookie,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.targets).toBeDefined();
      expect(Array.isArray(body.targets)).toBe(true);
      expect(body.targets.length).toBeGreaterThan(0);
      
      // Check that deleted targets are not included
      const allTargets = body.targets;
      expect(allTargets.every((t: any) => t.deleted_at === null || t.deleted_at === undefined)).toBe(true);
    });

    it('should reject unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/targets',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/targets/:id', () => {
    it('should get a specific target', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/targets/${targetId}`,
        headers: {
          cookie: authCookie,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.target).toBeDefined();
      expect(body.target.id).toBe(targetId);
      expect(body.target.name).toBe('Morning Routine');
    });

    it('should return 404 for non-existent target', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/targets/550e8400-e29b-41d4-a716-999999999999',
        headers: {
          cookie: authCookie,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/targets/${targetId}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/targets/:id', () => {
    it('should update a target', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/targets/${targetId}`,
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'Updated Morning Routine',
          duration_minutes: 150,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.target.name).toBe('Updated Morning Routine');
      expect(body.target.duration_minutes).toBe(150);
      expect(body.target.weekdays).toEqual([1, 2, 3, 4, 5]); // Should remain unchanged
    });

    it('should update only weekdays', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/targets/${targetId}`,
        headers: {
          cookie: authCookie,
        },
        payload: {
          weekdays: [1, 2, 3, 4, 5, 6, 0], // All days
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.target.weekdays).toEqual([1, 2, 3, 4, 5, 6, 0]);
      expect(body.target.name).toBe('Updated Morning Routine'); // Should remain unchanged
    });

    it('should return 404 for non-existent target', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/targets/550e8400-e29b-41d4-a716-999999999999',
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'Non-existent',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject invalid weekdays', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/targets/${targetId}`,
        headers: {
          cookie: authCookie,
        },
        payload: {
          weekdays: [10], // Invalid weekday
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/targets/:id', () => {
    it('should soft delete a target', async () => {
      // Create a target to delete
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/targets',
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'Target to Delete',
          duration_minutes: 30,
          weekdays: [1],
        },
      });

      const targetToDelete = JSON.parse(createResponse.body).target;

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/targets/${targetToDelete.id}`,
        headers: {
          cookie: authCookie,
        },
      });

      expect(deleteResponse.statusCode).toBe(204);

      // Verify target is no longer in list
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/targets',
        headers: {
          cookie: authCookie,
        },
      });

      const body = JSON.parse(listResponse.body);
      const deletedTarget = body.targets.find((t: any) => t.id === targetToDelete.id);
      expect(deletedTarget).toBeUndefined();
    });

    it('should return 404 for non-existent target', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/targets/550e8400-e29b-41d4-a716-999999999999',
        headers: {
          cookie: authCookie,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/sync/targets', () => {
    it('should get targets changed since timestamp', async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago

      const response = await app.inject({
        method: 'GET',
        url: `/api/sync/targets?since=${since}`,
        headers: {
          cookie: authCookie,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.targets).toBeDefined();
      expect(Array.isArray(body.targets)).toBe(true);
    });

    it('should reject invalid timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sync/targets?since=invalid-date',
        headers: {
          cookie: authCookie,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require since parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sync/targets',
        headers: {
          cookie: authCookie,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/sync/targets/push', () => {
    it('should push target changes', async () => {
      const clientId = '650e8400-e29b-41d4-a716-446655440000';
      const response = await app.inject({
        method: 'POST',
        url: '/api/sync/targets/push',
        headers: {
          cookie: authCookie,
        },
        payload: {
          targets: [
            {
              id: clientId,
              name: 'Synced Target',
              duration_minutes: 90,
              weekdays: [1, 3, 5],
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.targets).toBeDefined();
      expect(body.targets.length).toBe(1);
      expect(body.targets[0].id).toBe(clientId);
      expect(body.targets[0].name).toBe('Synced Target');
    });

    it('should handle multiple target changes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sync/targets/push',
        headers: {
          cookie: authCookie,
        },
        payload: {
          targets: [
            {
              id: '750e8400-e29b-41d4-a716-446655440000',
              name: 'Batch Target 1',
              duration_minutes: 60,
              weekdays: [1, 2],
              updated_at: new Date().toISOString(),
            },
            {
              id: '750e8400-e29b-41d4-a716-446655440001',
              name: 'Batch Target 2',
              duration_minutes: 90,
              weekdays: [3, 4],
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.targets.length).toBe(2);
    });

    it('should detect conflicts with newer server data', async () => {
      // Create a target
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/targets',
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'Conflict Test Target',
          duration_minutes: 60,
          weekdays: [1, 2, 3],
        },
      });

      const target = JSON.parse(createResponse.body).target;

      // Try to push with old timestamp
      const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const pushResponse = await app.inject({
        method: 'POST',
        url: '/api/sync/targets/push',
        headers: {
          cookie: authCookie,
        },
        payload: {
          targets: [
            {
              id: target.id,
              name: 'Conflicting Change',
              duration_minutes: 120,
              weekdays: [1, 2, 3],
              updated_at: oldTimestamp,
            },
          ],
        },
      });

      expect(pushResponse.statusCode).toBe(409);
      const body = JSON.parse(pushResponse.body);
      expect(body.conflicts).toBeDefined();
      expect(body.conflicts.length).toBe(1);
      expect(body.conflicts[0].id).toBe(target.id);
    });

    it('should handle soft-deleted targets in sync', async () => {
      const clientId = '850e8400-e29b-41d4-a716-446655440000';
      const response = await app.inject({
        method: 'POST',
        url: '/api/sync/targets/push',
        headers: {
          cookie: authCookie,
        },
        payload: {
          targets: [
            {
              id: clientId,
              name: 'Deleted Target',
              duration_minutes: 60,
              weekdays: [1],
              updated_at: new Date().toISOString(),
              deleted_at: new Date().toISOString(),
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.targets[0].deleted_at).toBeDefined();
    });
  });

  describe('Button Integration with Targets', () => {
    it('should create a button with target_id', async () => {
      // First create a target
      const targetResponse = await app.inject({
        method: 'POST',
        url: '/api/targets',
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'Work Target',
          duration_minutes: 480,
          weekdays: [1, 2, 3, 4, 5],
        },
      });

      const target = JSON.parse(targetResponse.body).target;

      // Create a button assigned to this target
      const buttonResponse = await app.inject({
        method: 'POST',
        url: '/api/buttons',
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'Work Button',
          emoji: '💼',
          color: '#3B82F6',
          position: 0,
          target_id: target.id,
        },
      });

      expect(buttonResponse.statusCode).toBe(201);
      const button = JSON.parse(buttonResponse.body);
      expect(button.target_id).toBe(target.id);
    });

    it('should allow button without target_id', async () => {
      const buttonResponse = await app.inject({
        method: 'POST',
        url: '/api/buttons',
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'Independent Button',
          emoji: '📝',
          color: '#10B981',
          position: 1,
          // No target_id
        },
      });

      expect(buttonResponse.statusCode).toBe(201);
      const button = JSON.parse(buttonResponse.body);
      expect(button.target_id).toBeUndefined();
    });

    it('should handle target deletion with assigned buttons', async () => {
      // Create target
      const targetResponse = await app.inject({
        method: 'POST',
        url: '/api/targets',
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'Target with Buttons',
          duration_minutes: 120,
          weekdays: [1, 2],
        },
      });

      const target = JSON.parse(targetResponse.body).target;

      // Create button assigned to target
      const buttonResponse = await app.inject({
        method: 'POST',
        url: '/api/buttons',
        headers: {
          cookie: authCookie,
        },
        payload: {
          name: 'Assigned Button',
          emoji: '🎯',
          color: '#F59E0B',
          position: 0,
          target_id: target.id,
        },
      });

      const button = JSON.parse(buttonResponse.body);

      // Delete target
      await app.inject({
        method: 'DELETE',
        url: `/api/targets/${target.id}`,
        headers: {
          cookie: authCookie,
        },
      });

      // Button should still exist but target_id should be null
      const getButtonResponse = await app.inject({
        method: 'GET',
        url: '/api/buttons',
        headers: {
          cookie: authCookie,
        },
      });

      const buttons = JSON.parse(getButtonResponse.body);
      const assignedButton = buttons.find((b: any) => b.id === button.id);
      expect(assignedButton).toBeDefined();
      expect(assignedButton.target_id).toBeNull();
    });
  });
});
