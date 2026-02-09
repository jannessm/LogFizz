import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TargetWithSpecs } from '../types';

// Store mock targets and timers for tests to modify
let mockTargets: TargetWithSpecs[] = [];
let mockTimers: { id: string; target_id: string; name: string }[] = [];

// Mock the db module
vi.mock('../lib/db', () => ({
  getAllTargets: vi.fn().mockResolvedValue([]),
  saveTarget: vi.fn(),
  deleteTarget: vi.fn(),
  addToSyncQueue: vi.fn(),
  getSyncCursor: vi.fn().mockResolvedValue({}),
  saveSyncCursor: vi.fn(),
}));

// Mock the sync service
vi.mock('../services/sync', () => ({
  syncService: {
    queueUpsertTarget: vi.fn().mockResolvedValue(undefined),
    queueDeleteTarget: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn().mockResolvedValue(undefined),
    afterSync: vi.fn(),
  },
}));

// Mock the holidays store
vi.mock('./holidays', () => ({
  holidaysStore: {
    fetchHolidaysForStates: vi.fn(),
  },
}));

// Mock the timers store to use our mockTimers array
vi.mock('./timers', () => ({
  timers: {
    subscribe: vi.fn((cb) => {
      cb(mockTimers);
      return () => {};
    }),
  },
}));

// Import after mocks are set up
import { targetsStore, targets } from './targets';
import { get } from 'svelte/store';
import * as db from '../lib/db';

describe('Targets Store', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Reset mock data
    mockTargets = [];
    mockTimers = [];
    
    // Reset the store
    targetsStore.updateWriteable(() => ({
      items: new Map(),
      isLoading: false,
      error: null,
      syncCallbackRegistered: false,
    }));
  });

  describe('getTargetsByTimerIds', () => {
    beforeEach(() => {
      // Setup test data
      mockTargets = [
        {
          id: 'target-1',
          user_id: 'user-1',
          name: 'Work Target',
          target_specs: [{
            id: 'spec-1',
            user_id: 'user-1',
            target_id: 'target-1',
            starting_from: '2025-01-01',
            duration_minutes: [0, 480, 480, 480, 480, 480, 0],
            exclude_holidays: false,
          }],
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 'target-2',
          user_id: 'user-1',
          name: 'Personal Target',
          target_specs: [{
            id: 'spec-2',
            user_id: 'user-1',
            target_id: 'target-2',
            starting_from: '2025-01-01',
            duration_minutes: [0, 240, 240, 240, 240, 240, 0],
            exclude_holidays: false,
          }],
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];
      
      mockTimers = [
        { id: 'timer-1', target_id: 'target-1', name: 'Work Timer' },
        { id: 'timer-2', target_id: 'target-1', name: 'Another Work Timer' },
        { id: 'timer-3', target_id: 'target-2', name: 'Personal Timer' },
      ];
      
      // Initialize store with mock targets
      vi.mocked(db.getAllTargets).mockResolvedValue(mockTargets);
    });

    it('should return empty array when timerIds is empty', async () => {
      await targetsStore.load(false);
      const result = await targetsStore.getTargetsByTimerIds([]);
      expect(result).toEqual([]);
    });

    it('should return targets for a single timer', async () => {
      await targetsStore.load(false);
      const result = await targetsStore.getTargetsByTimerIds(['timer-1']);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('target-1');
      expect(result[0].name).toBe('Work Target');
    });

    it('should return targets for multiple timers from the same target', async () => {
      await targetsStore.load(false);
      const result = await targetsStore.getTargetsByTimerIds(['timer-1', 'timer-2']);
      
      // Should return target-1 once (even though both timers belong to it)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('target-1');
    });

    it('should return multiple targets when timers belong to different targets', async () => {
      await targetsStore.load(false);
      const result = await targetsStore.getTargetsByTimerIds(['timer-1', 'timer-3']);
      
      expect(result).toHaveLength(2);
      const targetIds = result.map(t => t.id).sort();
      expect(targetIds).toEqual(['target-1', 'target-2']);
    });

    it('should return empty array when timerIds do not match any timers', async () => {
      await targetsStore.load(false);
      const result = await targetsStore.getTargetsByTimerIds(['non-existent-timer']);
      
      expect(result).toEqual([]);
    });

    it('should handle mixed valid and invalid timer IDs', async () => {
      await targetsStore.load(false);
      const result = await targetsStore.getTargetsByTimerIds(['timer-1', 'non-existent-timer']);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('target-1');
    });
  });
});
