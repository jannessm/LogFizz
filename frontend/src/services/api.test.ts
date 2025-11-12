import { describe, it, expect } from 'vitest';
import * as apiModule from './api';

// These tests verify that the API service exports exist and have the expected structure
// Detailed API behavior testing would require mocking fetch/ky which is complex with the current setup
// For now, we focus on integration tests that verify the stores work with mocked APIs

describe('API Service', () => {

  describe('Module exports', () => {
    it('should export authApi', () => {
      expect(apiModule.authApi).toBeDefined();
      expect(typeof apiModule.authApi.login).toBe('function');
      expect(typeof apiModule.authApi.register).toBe('function');
      expect(typeof apiModule.authApi.logout).toBe('function');
      expect(typeof apiModule.authApi.getCurrentUser).toBe('function');
      expect(typeof apiModule.authApi.changePassword).toBe('function');
      expect(typeof apiModule.authApi.updateProfile).toBe('function');
    });

    it('should export buttonApi', () => {
      expect(apiModule.buttonApi).toBeDefined();
      expect(typeof apiModule.buttonApi.getAll).toBe('function');
      expect(typeof apiModule.buttonApi.get).toBe('function');
      expect(typeof apiModule.buttonApi.create).toBe('function');
      expect(typeof apiModule.buttonApi.update).toBe('function');
      expect(typeof apiModule.buttonApi.delete).toBe('function');
    });

    it('should export timeLogApi', () => {
      expect(apiModule.timeLogApi).toBeDefined();
      expect(typeof apiModule.timeLogApi.start).toBe('function');
      expect(typeof apiModule.timeLogApi.stop).toBe('function');
      expect(typeof apiModule.timeLogApi.getActive).toBe('function');
      expect(typeof apiModule.timeLogApi.getAll).toBe('function');
    });

    it('should export holidayApi', () => {
      expect(apiModule.holidayApi).toBeDefined();
      expect(typeof apiModule.holidayApi.getHolidays).toBe('function');
      expect(typeof apiModule.holidayApi.getWorkingDays).toBe('function');
    });

    it('should export utility functions', () => {
      expect(typeof apiModule.isOnline).toBe('function');
      expect(typeof apiModule.retryRequest).toBe('function');
    });
  });

  describe('isOnline', () => {
    it('should return a boolean', () => {
      const result = apiModule.isOnline();
      expect(typeof result).toBe('boolean');
    });
  });
});
