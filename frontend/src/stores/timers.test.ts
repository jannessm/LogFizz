import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Timer } from '../types';
import { mapToArray } from './base-store';

// Mock the db module
vi.mock('../lib/db', () => ({
  getAllTimers: vi.fn(),
  saveTimer: vi.fn(),
  deleteTimer: vi.fn(),
  addToSyncQueue: vi.fn(),
  getSyncCursor: vi.fn().mockResolvedValue({}),
  saveSyncCursor: vi.fn(),
  getUser: vi.fn().mockResolvedValue(null),
}));

// Mock the sync service
vi.mock('../services/sync', () => ({
  syncService: {
    queueUpsertTimer: vi.fn().mockResolvedValue(undefined),
    queueDeleteTimer: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn().mockResolvedValue(undefined),
  },
}));

import * as db from '../lib/db';
import { timersStore, timers } from './timers';
import { get } from 'svelte/store';

// Helper to initialize store with timers
async function initStoreWithTimers(timersList: Timer[]) {
  vi.mocked(db.getAllTimers).mockResolvedValue(timersList);
  await timersStore.load();
}

describe('timersStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('load', () => {
    it('should load timers from database', async () => {
      const mockTimers: Timer[] = [
        {
          id: 'timer-1',
          user_id: 'user-1',
          name: 'Work',
          emoji: '💼',
          color: '#ff0000',
          auto_subtract_breaks: true,
          archived: false,
          created_at: '2024-12-01T00:00:00Z',
          updated_at: '2024-12-01T00:00:00Z',
        },
        {
          id: 'timer-2',
          user_id: 'user-1',
          name: 'Study',
          emoji: '📚',
          color: '#00ff00',
          auto_subtract_breaks: false,
          archived: false,
          created_at: '2024-12-01T00:00:00Z',
          updated_at: '2024-12-01T00:00:00Z',
        },
      ];

      await initStoreWithTimers(mockTimers);

      const state = get(timersStore);
      expect(state.items.size).toBe(2);
      const items = mapToArray(state.items);
      expect(items[0].name).toBe('Work');
      expect(items[1].name).toBe('Study');
    });

    it('should filter out deleted timers', async () => {
      const mockTimers: Timer[] = [
        {
          id: 'timer-1',
          user_id: 'user-1',
          name: 'Active Timer',
          auto_subtract_breaks: false,
          archived: false,
          created_at: '2024-12-01T00:00:00Z',
          updated_at: '2024-12-01T00:00:00Z',
        },
        {
          id: 'timer-2',
          user_id: 'user-1',
          name: 'Deleted Timer',
          auto_subtract_breaks: false,
          archived: false,
          created_at: '2024-12-01T00:00:00Z',
          updated_at: '2024-12-01T00:00:00Z',
          deleted_at: '2024-12-02T00:00:00Z',
        },
      ];

      await initStoreWithTimers(mockTimers);

      const state = get(timersStore);
      expect(state.items.size).toBe(1);
      expect(state.items.get('timer-1')?.name).toBe('Active Timer');
    });
  });

  describe('create', () => {
    it('should create a new timer with default values', async () => {
      await initStoreWithTimers([]);
      vi.mocked(db.saveTimer).mockResolvedValue();

      const newTimer = await timersStore.create({
        name: 'New Timer',
        emoji: '⏰',
        color: '#0000ff',
      });

      expect(newTimer.name).toBe('New Timer');
      expect(newTimer.emoji).toBe('⏰');
      expect(newTimer.color).toBe('#0000ff');
      expect(newTimer.auto_subtract_breaks).toBe(false);
      expect(newTimer.archived).toBe(false);
      expect(newTimer.id).toBeDefined();
      expect(db.saveTimer).toHaveBeenCalled();
    });

    it('should create timer with auto_subtract_breaks enabled', async () => {
      await initStoreWithTimers([]);
      vi.mocked(db.saveTimer).mockResolvedValue();

      const newTimer = await timersStore.create({
        name: 'Work Timer',
        auto_subtract_breaks: true,
      });

      expect(newTimer.auto_subtract_breaks).toBe(true);
    });
  });

  describe('update', () => {
    it('should update an existing timer', async () => {
      const existingTimer: Timer = {
        id: 'timer-1',
        user_id: 'user-1',
        name: 'Old Name',
        auto_subtract_breaks: false,
        archived: false,
        created_at: '2024-12-01T00:00:00Z',
        updated_at: '2024-12-01T00:00:00Z',
      };

      await initStoreWithTimers([existingTimer]);
      vi.mocked(db.saveTimer).mockResolvedValue();

      const updatedTimer = await timersStore.update('timer-1', {
        name: 'New Name',
        color: '#ff0000',
      });

      expect(updatedTimer.name).toBe('New Name');
      expect(updatedTimer.color).toBe('#ff0000');
      expect(db.saveTimer).toHaveBeenCalled();
    });

    it('should throw error when updating non-existent timer', async () => {
      await initStoreWithTimers([]);

      await expect(
        timersStore.update('non-existent', { name: 'Test' })
      ).rejects.toThrow('Timer not found');
    });
  });

  describe('delete', () => {
    it('should delete an existing timer', async () => {
      const existingTimer: Timer = {
        id: 'timer-1',
        user_id: 'user-1',
        name: 'To Delete',
        auto_subtract_breaks: false,
        archived: false,
        created_at: '2024-12-01T00:00:00Z',
        updated_at: '2024-12-01T00:00:00Z',
      };

      await initStoreWithTimers([existingTimer]);
      vi.mocked(db.deleteTimer).mockResolvedValue();

      await timersStore.delete(existingTimer);

      const state = get(timersStore);
      expect(state.items.size).toBe(0);
      expect(db.deleteTimer).toHaveBeenCalledWith(existingTimer);
    });
  });

  describe('archived field', () => {
    it('should create timer with archived: false by default', async () => {
      await initStoreWithTimers([]);
      vi.mocked(db.saveTimer).mockResolvedValue();

      const newTimer = await timersStore.create({
        name: 'New Timer',
      });

      expect(newTimer.archived).toBe(false);
    });

    it('should allow creating archived timer', async () => {
      await initStoreWithTimers([]);
      vi.mocked(db.saveTimer).mockResolvedValue();

      const newTimer = await timersStore.create({
        name: 'Archived Timer',
        archived: true,
      });

      expect(newTimer.archived).toBe(true);
    });

    it('should update archived status', async () => {
      const existingTimer: Timer = {
        id: 'timer-1',
        user_id: 'user-1',
        name: 'Active Timer',
        auto_subtract_breaks: false,
        archived: false,
        created_at: '2024-12-01T00:00:00Z',
        updated_at: '2024-12-01T00:00:00Z',
      };

      await initStoreWithTimers([existingTimer]);
      vi.mocked(db.saveTimer).mockResolvedValue();

      const updatedTimer = await timersStore.update('timer-1', {
        archived: true,
      });

      expect(updatedTimer.archived).toBe(true);
    });

    it('should load both archived and non-archived timers', async () => {
      const mockTimers: Timer[] = [
        {
          id: 'timer-1',
          user_id: 'user-1',
          name: 'Active Timer',
          auto_subtract_breaks: false,
          archived: false,
          created_at: '2024-12-01T00:00:00Z',
          updated_at: '2024-12-01T00:00:00Z',
        },
        {
          id: 'timer-2',
          user_id: 'user-1',
          name: 'Archived Timer',
          auto_subtract_breaks: false,
          archived: true,
          created_at: '2024-12-01T00:00:00Z',
          updated_at: '2024-12-01T00:00:00Z',
        },
      ];

      await initStoreWithTimers(mockTimers);

      const state = get(timersStore);
      expect(state.items.size).toBe(2);
      const items = mapToArray(state.items);
      expect(items.filter(t => t.archived)).toHaveLength(1);
      expect(items.filter(t => !t.archived)).toHaveLength(1);
    });
  });

  describe('derived stores', () => {
    it('timers derived store should return items', async () => {
      const mockTimers: Timer[] = [
        {
          id: 'timer-1',
          user_id: 'user-1',
          name: 'Test Timer',
          auto_subtract_breaks: false,
          archived: false,
          created_at: '2024-12-01T00:00:00Z',
          updated_at: '2024-12-01T00:00:00Z',
        },
      ];

      await initStoreWithTimers(mockTimers);

      const timersList = get(timers);
      expect(timersList).toHaveLength(1);
      expect(timersList[0].name).toBe('Test Timer');
    });
  });
});
