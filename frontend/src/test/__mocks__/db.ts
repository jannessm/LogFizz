import { vi } from 'vitest';

// Mock IndexedDB operations
export const getDB = vi.fn();
export const saveButton = vi.fn().mockResolvedValue(undefined);
export const getButton = vi.fn().mockResolvedValue(null);
export const getAllButtons = vi.fn().mockResolvedValue([]);
export const deleteButton = vi.fn().mockResolvedValue(undefined);

export const saveTimeLog = vi.fn().mockResolvedValue(undefined);
export const getTimeLog = vi.fn().mockResolvedValue(null);
export const getAllTimeLogs = vi.fn().mockResolvedValue([]);
export const getTimeLogsByButton = vi.fn().mockResolvedValue([]);
export const deleteTimeLog = vi.fn().mockResolvedValue(undefined);

export const addToSyncQueue = vi.fn().mockResolvedValue(undefined);
export const getUnsyncedItems = vi.fn().mockResolvedValue([]);
export const markItemSynced = vi.fn().mockResolvedValue(undefined);
export const deleteFromSyncQueue = vi.fn().mockResolvedValue(undefined);

export const saveUser = vi.fn().mockResolvedValue(undefined);
export const getUser = vi.fn().mockResolvedValue(null);
export const clearUser = vi.fn().mockResolvedValue(undefined);

export const saveSetting = vi.fn().mockResolvedValue(undefined);
export const getSetting = vi.fn().mockResolvedValue(null);

export const clearAllData = vi.fn().mockResolvedValue(undefined);

// Balance operations
export const saveBalance = vi.fn().mockResolvedValue(undefined);
export const deleteBalance = vi.fn().mockResolvedValue(undefined);
export const getAllBalances = vi.fn().mockResolvedValue([]);
export const getBalance = vi.fn().mockResolvedValue(null);
export const getBalancesByDate = vi.fn().mockResolvedValue([]);
export const getBalancesByTargetId = vi.fn().mockResolvedValue([]);

// Balance calc metadata
export const getBalanceCalcMeta = vi.fn().mockResolvedValue(null);
export const setBalanceCalcMetaForTarget = vi.fn().mockResolvedValue(undefined);
export const clearBalanceCalcMeta = vi.fn().mockResolvedValue(undefined);

// Sync cursor operations
export const getSyncCursor = vi.fn().mockResolvedValue(undefined);
export const saveSyncCursor = vi.fn().mockResolvedValue(undefined);

// Timer operations
export const saveTimer = vi.fn().mockResolvedValue(undefined);
export const deleteTimer = vi.fn().mockResolvedValue(undefined);
export const getAllTimers = vi.fn().mockResolvedValue([]);

// Target operations
export const saveTarget = vi.fn().mockResolvedValue(undefined);
export const deleteTarget = vi.fn().mockResolvedValue(undefined);
export const getAllTargets = vi.fn().mockResolvedValue([]);

// Timelog date index
export const getTimelogIdsForDate = vi.fn().mockResolvedValue([]);
export const getTimeLogsByIds = vi.fn().mockResolvedValue([]);
export const clearTimelogDateIndex = vi.fn().mockResolvedValue(undefined);
export const rebuildTimelogDateIndex = vi.fn().mockResolvedValue(undefined);
export const ensureTimelogDateIndex = vi.fn().mockResolvedValue(undefined);
