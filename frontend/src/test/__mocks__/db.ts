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
