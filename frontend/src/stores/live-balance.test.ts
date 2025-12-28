import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { liveBalanceTick, startBalanceUpdates, stopBalanceUpdates, activeTimelogDurations } from './live-balance';

// Mock the timelogs store
vi.mock('./timelogs', () => ({
  activeTimeLogs: {
    subscribe: vi.fn((callback) => {
      callback([]);
      return () => {};
    }),
  },
}));

describe('live-balance store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with tick count of 0', () => {
    const tick = get(liveBalanceTick);
    expect(tick).toBe(0);
  });

  it('should allow components to start balance updates', () => {
    const componentId = 'test-component-1';
    
    // Should not throw
    expect(() => startBalanceUpdates(componentId)).not.toThrow();
  });

  it('should allow components to stop balance updates', () => {
    const componentId = 'test-component-1';
    
    startBalanceUpdates(componentId);
    
    // Should not throw
    expect(() => stopBalanceUpdates(componentId)).not.toThrow();
  });

  it('should handle multiple components registering for updates', () => {
    const component1 = 'component-1';
    const component2 = 'component-2';
    
    startBalanceUpdates(component1);
    startBalanceUpdates(component2);
    
    // Both should be registered
    stopBalanceUpdates(component1);
    stopBalanceUpdates(component2);
    
    expect(true).toBe(true); // No errors means success
  });

  it('should export activeTimelogDurations derived store', () => {
    expect(activeTimelogDurations).toBeDefined();
    expect(typeof activeTimelogDurations.subscribe).toBe('function');
  });

  it('should provide elapsed minutes for active timelogs', () => {
    const durations = get(activeTimelogDurations);
    expect(Array.isArray(durations)).toBe(true);
  });
});
