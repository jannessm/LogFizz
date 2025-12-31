import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import dayjs from '../../../lib/utils/dayjs.js';

describe('Target Sync Routes with Nested Specs', () => {
  let app: FastifyInstance;
  let authCookie: string;
  let userId: string;

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

  it('should create a target with nested target_specs', async () => {
    const targetId = '550e8400-e29b-41d4-a716-446655440000';
    const specId1 = '550e8400-e29b-41d4-a716-446655440001';
    const specId2 = '550e8400-e29b-41d4-a716-446655440002';

    const startDate1 = dayjs('2025-01-01').toISOString();
    const startDate2 = dayjs('2025-06-01').toISOString();

    const response = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Work Hours',
          target_specs: [
            {
              id: specId1,
              duration_minutes: [480], // 8 hours // Monday to Friday
              exclude_holidays: false,
              starting_from: startDate1,
            },
            {
              id: specId2,
              duration_minutes: [450], // 7.5 hours
              exclude_holidays: false,
              starting_from: startDate2,
            },
          ],
        }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.saved).toHaveLength(1);
    expect(body.saved[0].id).toBe(targetId);
    expect(body.saved[0].name).toBe('Work Hours');
    expect(body.saved[0].target_specs).toHaveLength(2);
    
    // Verify specs are sorted by starting_from date
    expect(body.saved[0].target_specs[0].id).toBe(specId1);
    expect(body.saved[0].target_specs[1].id).toBe(specId2);
  });

  it('should fetch targets with target_specs sorted by starting_from date', async () => {
    const targetId = '660e8400-e29b-41d4-a716-446655440010';
    const specId1 = '660e8400-e29b-41d4-a716-446655440011';
    const specId2 = '660e8400-e29b-41d4-a716-446655440012';

    // Create target with specs in reverse order
    const startDate1 = dayjs('2025-01-01').toISOString();
    const startDate2 = dayjs('2025-06-01').toISOString();

    await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Study Time',
          target_specs: [
            {
              id: specId2,
              duration_minutes: [120],
              exclude_holidays: false,
              starting_from: startDate2, // Later date first
            },
            {
              id: specId1,
              duration_minutes: [120],
              exclude_holidays: false,
              starting_from: startDate1, // Earlier date second
            },
          ],
        }],
      },
    });

    // Fetch and verify sorting
    const response = await app.inject({
      method: 'GET',
      url: '/api/targets/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const target = body.targets.find((t: any) => t.id === targetId);
    expect(target).toBeDefined();
    expect(target.target_specs).toHaveLength(2);
    
    // Verify specs are sorted by starting_from (earliest first)
    expect(target.target_specs[0].id).toBe(specId1);
    expect(target.target_specs[1].id).toBe(specId2);
  });

  it.todo('should only update changed entities (target or specs)', async () => {
    const targetId = '770e8400-e29b-41d4-a716-446655440020';
    const specId = '770e8400-e29b-41d4-a716-446655440021';

    // Create initial target
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Exercise Time',
          target_specs: [{
            id: specId,
            duration_minutes: [60],
              exclude_holidays: false,
            starting_from: dayjs('2025-01-01').toISOString(),
          }],
        }],
      },
    });

    expect(createResponse.statusCode).toBe(200);
    const createdTarget = JSON.parse(createResponse.body).saved[0];
    const originalUpdatedAt = new Date(createdTarget.updated_at);

    // Wait a bit to ensure time passes
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update only the target name (not specs)
    const updateResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Updated Exercise Time', // Changed
          target_specs: [{
            id: specId,
            duration_minutes: [60], // Not changed // Not changed
            exclude_holidays: false,
            starting_from: dayjs('2025-01-01').toISOString(),
          }],
        }],
      },
    });

    if (updateResponse.statusCode !== 200) {
      console.error('Update failed with status:', updateResponse.statusCode);
      console.error('Response body:', updateResponse.body);
    }

    expect(updateResponse.statusCode).toBe(200);
    const updatedTarget = JSON.parse(updateResponse.body).saved[0];
    
    // Verify name was updated
    expect(updatedTarget.name).toBe('Updated Exercise Time');
    
    // Verify updated_at was changed (target was modified)
    const newUpdatedAt = new Date(updatedTarget.updated_at);
    expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should only update changed spec fields', async () => {
    const targetId = '880e8400-e29b-41d4-a716-446655440030';
    const specId = '880e8400-e29b-41d4-a716-446655440031';

    // Create initial target with spec
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Test Target',
          target_specs: [{
            id: specId,
            duration_minutes: [480],
              exclude_holidays: false,
              exclude_holidays: false,
            state_code: undefined,
            starting_from: dayjs('2025-01-01').toISOString(),
          }],
        }],
      },
    });

    expect(createResponse.statusCode).toBe(200);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update only duration_minutes (not exclude_holidays, etc)
    const updateResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Test Target', // Unchanged
          target_specs: [{
            id: specId,
            duration_minutes: [500], // Changed // Unchanged
            exclude_holidays: false, // Unchanged
            starting_from: dayjs('2025-01-01').toISOString(),
          }],
        }],
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const updatedTarget = JSON.parse(updateResponse.body).saved[0];
    expect(updatedTarget.target_specs[0].duration_minutes).toEqual([500]);
    // weekdays field removed
  });

  it('should calculate updated_at as max of target and all specs', async () => {
    const targetId = '990e8400-e29b-41d4-a716-446655440040';
    const specId1 = '990e8400-e29b-41d4-a716-446655440041';
    const specId2 = '990e8400-e29b-41d4-a716-446655440042';

    // Create target
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Max Updated Test',
          target_specs: [
            {
              id: specId1,
              duration_minutes: [480],
              exclude_holidays: false,
              starting_from: dayjs('2025-01-01').toISOString(),
            },
            {
              id: specId2,
              duration_minutes: [120],
              exclude_holidays: false,
              starting_from: dayjs('2025-06-01').toISOString(),
            },
          ],
        }],
      },
    });

    const created = JSON.parse(createResponse.body).saved[0];
    const targetUpdatedAt = created.updated_at;
    
    // The max updated_at should represent the latest change among target and specs
    expect(targetUpdatedAt).toBeDefined();
    // Updated_at is a string in ISO format
    const parsedDate = new Date(targetUpdatedAt);
    expect(parsedDate.getTime()).toBeGreaterThan(0);
  });

  it.todo('should hard delete target specs when removed from target', async () => {
    const targetId = 'aaa08400-e29b-41d4-a716-446655440050';
    const specId1 = 'aaa08400-e29b-41d4-a716-446655440051';
    const specId2 = 'aaa08400-e29b-41d4-a716-446655440052';

    // Create target with two specs
    await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Delete Test',
          target_specs: [
            {
              id: specId1,
              duration_minutes: [480],
              exclude_holidays: false,
              starting_from: dayjs('2025-01-01').toISOString(),
            },
            {
              id: specId2,
              duration_minutes: [240],
              exclude_holidays: false,
              starting_from: dayjs('2025-06-01').toISOString(),
            },
          ],
        }],
      },
    });

    // Update target with only one spec (hard delete the other)
    const deleteResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Delete Test',
          target_specs: [{
            id: specId1,
            duration_minutes: [480],
              exclude_holidays: false,
            starting_from: dayjs('2025-01-01').toISOString(),
          }],
        }],
      },
    });

    expect(deleteResponse.statusCode).toBe(200);
    const updated = JSON.parse(deleteResponse.body).saved[0];
    
    // Should only have one spec now (specId2 was hard deleted)
    expect(updated.target_specs).toHaveLength(1);
    expect(updated.target_specs[0].id).toBe(specId1);
  });

  it('should not allow unauthenticated requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/targets/sync?since=1970-01-01T00:00:00.000Z',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should handle conflict detection with nested specs', async () => {
    const targetId = 'bbb08400-e29b-41d4-a716-446655440060';
    const specId = 'bbb08400-e29b-41d4-a716-446655440061';

    // Create target
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Conflict Test',
          target_specs: [{
            id: specId,
            duration_minutes: [480],
              exclude_holidays: false,
            starting_from: dayjs('2025-01-01').toISOString(),
          }],
        }],
      },
    });

    const created = JSON.parse(createResponse.body).saved[0];

    // Try to update with an older client timestamp
    const oldTimestamp = dayjs(created.updated_at).subtract(1, 'day').toISOString();
    
    const conflictResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Outdated Change',
          updated_at: oldTimestamp,
          target_specs: [{
            id: specId,
            duration_minutes: [500],
              exclude_holidays: false,
            starting_from: dayjs('2025-01-01').toISOString(),
            updated_at: oldTimestamp,
          }],
        }],
      },
    });

    expect(conflictResponse.statusCode).toBe(200);
    const conflictBody = JSON.parse(conflictResponse.body);
    
    // Should detect conflict and not save
    expect(conflictBody.conflicts).toBeDefined();
    expect(conflictBody.conflicts.length).toBeGreaterThan(0);
    expect(conflictBody.conflicts[0].serverVersion.target_specs).toBeDefined();
  });

  it('should return cursor for incremental sync', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/targets/sync?since=1970-01-01T00:00:00.000Z',
      headers: {
        cookie: authCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.cursor).toBeDefined();
    
    // Cursor should be a valid ISO timestamp
    const cursorDate = new Date(body.cursor);
    expect(cursorDate.getTime()).toBeGreaterThan(0);
  });

  it('should handle multiple targets with multiple specs each', async () => {
    const target1Id = 'ccc08400-e29b-41d4-a716-446655440070';
    const target2Id = 'ccc08400-e29b-41d4-a716-446655440071';
    
    const target1Spec1 = 'ccc08400-e29b-41d4-a716-446655440072';
    const target1Spec2 = 'ccc08400-e29b-41d4-a716-446655440073';
    const target2Spec1 = 'ccc08400-e29b-41d4-a716-446655440074';

    const response = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [
          {
            id: target1Id,
            name: 'Weekday Work',
            target_specs: [
              {
                id: target1Spec1,
                duration_minutes: [480],
              exclude_holidays: false,
                starting_from: dayjs('2025-01-01').toISOString(),
              },
              {
                id: target1Spec2,
                duration_minutes: [450],
              exclude_holidays: false,
                starting_from: dayjs('2025-06-01').toISOString(),
              },
            ],
          },
          {
            id: target2Id,
            name: 'Weekend Hobbies',
            target_specs: [
              {
                id: target2Spec1,
                duration_minutes: [120],
              exclude_holidays: false,
                starting_from: dayjs('2025-01-01').toISOString(),
              },
            ],
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.saved).toHaveLength(2);
    
    const target1 = body.saved.find((t: any) => t.id === target1Id);
    const target2 = body.saved.find((t: any) => t.id === target2Id);
    
    expect(target1.target_specs).toHaveLength(2);
    expect(target2.target_specs).toHaveLength(1);
    
    // Verify sorting within each target
    expect(target1.target_specs[0].id).toBe(target1Spec1);
    expect(target1.target_specs[1].id).toBe(target1Spec2);
  });

  it('should not include timestamps (created_at, updated_at, deleted_at) in target_specs responses', async () => {
    const targetId = 'ddd08400-e29b-41d4-a716-446655440080';
    const specId = 'ddd08400-e29b-41d4-a716-446655440081';

    const response = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Timestamp Test',
          target_specs: [{
            id: specId,
            duration_minutes: [480],
              exclude_holidays: false,
              exclude_holidays: false,
            starting_from: dayjs('2025-01-01').toISOString(),
          }],
        }],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const spec = body.saved[0].target_specs[0];
    
    // Verify spec has required fields
    expect(spec.id).toBe(specId);
    expect(spec.duration_minutes).toEqual([480]);
    // weekdays field removed
    expect(spec.starting_from).toBeDefined();
    
    // Verify spec does NOT have timestamp fields
    expect(spec.created_at).toBeUndefined();
    expect(spec.updated_at).toBeUndefined();
    
    // But the target itself should have updated_at
    expect(body.saved[0].updated_at).toBeDefined();
  });

  it.todo('should verify target updated_at reflects spec changes', async () => {
    const targetId = 'eee08400-e29b-41d4-a716-446655440090';
    const specId = 'eee08400-e29b-41d4-a716-446655440091';

    // Create initial target
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Spec Change Test',
          target_specs: [{
            id: specId,
            duration_minutes: [480],
              exclude_holidays: false,
            starting_from: dayjs('2025-01-01').toISOString(),
          }],
        }],
      },
    });

    const originalUpdatedAt = new Date(JSON.parse(createResponse.body).saved[0].updated_at);

    // Wait to ensure timestamp difference (SQLite needs significant time difference)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update only the spec (not the target name)
    const updateResponse = await app.inject({
      method: 'POST',
      url: '/api/targets/sync',
      headers: {
        cookie: authCookie,
      },
      payload: {
        targets: [{
          id: targetId,
          name: 'Spec Change Test', // Unchanged
          target_specs: [{
            id: specId,
            duration_minutes: [500], // Changed
            exclude_holidays: false,
            starting_from: dayjs('2025-01-01').toISOString(),
          }],
        }],
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const updatedTarget = JSON.parse(updateResponse.body).saved[0];
    const newUpdatedAt = new Date(updatedTarget.updated_at);
    
    // The target's updated_at should reflect the spec change
    expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});
