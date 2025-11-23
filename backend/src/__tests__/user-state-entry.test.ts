import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AppDataSource } from '../config/database.js';
import { UserStateEntryService } from '../services/user-state-entry.service.js';
import { StateService } from '../services/state.service.js';
import { User } from '../entities/User.js';
import { UserStateEntry } from '../entities/UserStateEntry.js';

describe('UserStateEntryService', () => {
  let service: UserStateEntryService;
  let stateService: StateService;
  let testUserId: string;
  let testStateId: string; // Berlin

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    service = new UserStateEntryService();
    stateService = new StateService();

    // Get a test state (Berlin) - seeded by testDatabase.ts
    const berlinState = await stateService.getStateByCode('DE-BE');
    if (!berlinState) {
      throw new Error('Berlin state not found in database');
    }
    testStateId = berlinState.id;

    // Create a test user
    const userRepo = AppDataSource.getRepository(User);
    const user = userRepo.create({
      email: 'statetest@example.com',
      password_hash: 'hashed',
      name: 'State Test User',
    });
    const savedUser = await userRepo.save(user);
    testUserId = savedUser.id;
  });

  afterAll(async () => {
    // Cleanup
    const userRepo = AppDataSource.getRepository(User);
    await userRepo.delete({ id: testUserId });
    
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Hard delete all state entries for this user (including soft-deleted ones)
    const stateEntryRepo = AppDataSource.getRepository(UserStateEntry);
    await stateEntryRepo.delete({ user_id: testUserId });
  });

  it('should create a new state entry', async () => {
    const registeredAt = new Date();
    const entry = await service.createStateEntry(
      testUserId,
      testStateId,
      registeredAt
    );

    expect(entry).toBeDefined();
    expect(entry.id).toBeDefined();
    expect(entry.user_id).toBe(testUserId);
    expect(entry.state_id).toBe(testStateId);
  });

  it('should get all state entries for a user', async () => {
    const now = new Date();
    const entry1 = await service.createStateEntry(testUserId, testStateId, now);
    const entry2 = await service.createStateEntry(testUserId, testStateId, new Date(now.getTime() + 1000));

    const entries = await service.getStateEntriesByUser(testUserId);
    expect(entries).toHaveLength(2);
    // Should be ordered by registered_at DESC
    expect(entries[0].id).toBe(entry2.id);
    expect(entries[1].id).toBe(entry1.id);
  });

  it('should get a single state entry by ID', async () => {
    const entry = await service.createStateEntry(testUserId, testStateId, new Date());
    const retrieved = await service.getStateEntryById(testUserId, entry.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(entry.id);
    expect(retrieved?.state_id).toBe(testStateId);
  });

  it('should update a state entry', async () => {
    const entry = await service.createStateEntry(testUserId, testStateId, new Date());
    
    // Get another state for updating
    const bayernState = await stateService.getStateByCode('DE-BY');
    const updated = await service.updateStateEntry(testUserId, entry.id, {
      state_id: bayernState!.id,
    });

    expect(updated).toBeDefined();
    expect(updated?.state_id).toBe(bayernState!.id);
  });

  it('should soft delete a state entry', async () => {
    const entry = await service.createStateEntry(testUserId, testStateId, new Date());
    const deleted = await service.deleteStateEntry(testUserId, entry.id);

    expect(deleted).toBe(true);

    const entries = await service.getStateEntriesByUser(testUserId);
    expect(entries).toHaveLength(0);
  });

  it('should get the most recent state entry', async () => {
    const now = new Date();
    await service.createStateEntry(testUserId, testStateId, new Date(now.getTime() - 2000));
    await service.createStateEntry(testUserId, testStateId, new Date(now.getTime() - 1000));
    const latest = await service.createStateEntry(testUserId, testStateId, now);

    const mostRecent = await service.getMostRecentStateEntry(testUserId);
    expect(mostRecent).toBeDefined();
    expect(mostRecent?.id).toBe(latest.id);
    expect(mostRecent?.state_id).toBe(testStateId);
  });

  it('should get state entries in a date range', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const entry1 = await service.createStateEntry(testUserId, testStateId, twoDaysAgo);
    const entry2 = await service.createStateEntry(testUserId, testStateId, yesterday);
    const entry3 = await service.createStateEntry(testUserId, testStateId, now);

    const entries = await service.getStateEntriesInRange(
      testUserId,
      yesterday,
      now
    );

    expect(entries).toHaveLength(2);
    expect(entries.some(e => e.id === entry2.id)).toBe(true);
    expect(entries.some(e => e.id === entry3.id)).toBe(true);
    expect(entries.some(e => e.id === entry1.id)).toBe(false);
  });

  it('should handle sync with conflict detection', async () => {
    const now = new Date();
    const entry = await service.createStateEntry(testUserId, testStateId, now);

    // Get another state for the conflict test
    const bayernState = await stateService.getStateByCode('DE-BY');

    // Simulate a client pushing an older version
    const olderTimestamp = new Date(now.getTime() - 1000);
    const result = await service.pushStateEntryChanges(testUserId, [
      {
        id: entry.id,
        state_id: bayernState!.id,
        updated_at: olderTimestamp,
      },
    ]);

    expect(result.conflicts).toHaveLength(1);
    expect(result.saved).toHaveLength(0);
    expect(result.conflicts[0].serverVersion.state_id).toBe(testStateId);
  });

  it('should sync without conflicts when client is newer', async () => {
    const past = new Date(Date.now() - 5000);
    const entry = await service.createStateEntry(testUserId, testStateId, past);

    // Get another state for updating
    const bayernState = await stateService.getStateByCode('DE-BY');

    // Simulate a client pushing a newer version
    const newerTimestamp = new Date();
    const result = await service.pushStateEntryChanges(testUserId, [
      {
        id: entry.id,
        state_id: bayernState!.id,
        registered_at: past,
        updated_at: newerTimestamp,
      },
    ]);

    expect(result.conflicts).toHaveLength(0);
    expect(result.saved).toHaveLength(1);
    expect(result.saved[0].state_id).toBe(bayernState!.id);
  });
});
