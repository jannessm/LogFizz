import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ky module - must use inline factory with no external references
vi.mock('ky', () => ({
  default: {
    create: vi.fn(() => ({
      post: vi.fn(() => ({ json: vi.fn() })),
      get: vi.fn(() => ({ json: vi.fn() })),
      put: vi.fn(() => ({ json: vi.fn() })),
      delete: vi.fn(),
    })),
  },
}));

// Import after mocking
import { authApi } from './api';
import ky from 'ky';

// Get the mocked ky instance
const mockedKy = vi.mocked(ky);

describe('API Service', () => {
  let mockPost: any;
  let mockGet: any;
  let mockPut: any;
  let mockDelete: any;

  beforeEach(() => {
    // Get fresh mock instances for each test
    const mockInstance = (mockedKy.create as any)();
    mockPost = mockInstance.post;
    mockGet = mockInstance.get;
    mockPut = mockInstance.put;
    mockDelete = mockInstance.delete;
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('authApi', () => {
    describe('logout', () => {
      it('should call POST without json body or Content-Type header', async () => {
        mockPost.mockReturnValue(Promise.resolve());

        await authApi.logout();

        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockPost).toHaveBeenCalledWith('api/auth/logout', {
          headers: { 'Content-Type': undefined }
        });
      });

      it('should not send any request body', async () => {
        mockPost.mockReturnValue(Promise.resolve());

        await authApi.logout();

        const callArgs = mockPost.mock.calls[0];
        expect(callArgs[1]).toBeDefined();
        expect(callArgs[1].json).toBeUndefined();
        expect(callArgs[1].body).toBeUndefined();
      });

      it('should remove Content-Type header', async () => {
        mockPost.mockReturnValue(Promise.resolve());

        await authApi.logout();

        const callArgs = mockPost.mock.calls[0];
        expect(callArgs[1].headers).toBeDefined();
        expect(callArgs[1].headers['Content-Type']).toBeUndefined();
      });

      it('should handle successful logout', async () => {
        mockPost.mockReturnValue(Promise.resolve());

        await expect(authApi.logout()).resolves.not.toThrow();
      });

      it('should handle logout errors', async () => {
        const error = new Error('Network error');
        mockPost.mockReturnValue(Promise.reject(error));

        await expect(authApi.logout()).rejects.toThrow('Network error');
      });
    });

    describe('login', () => {
      it('should send json body with credentials', async () => {
        const mockUser = { id: '1', email: 'test@example.com', name: 'Test' };
        const mockJsonFn = vi.fn().mockResolvedValue(mockUser);
        mockPost.mockReturnValue({
          json: mockJsonFn,
        });

        const result = await authApi.login('test@example.com', 'password123');

        expect(mockPost).toHaveBeenCalledWith('api/auth/login', {
          json: { email: 'test@example.com', password: 'password123' }
        });
        expect(mockJsonFn).toHaveBeenCalled();
        expect(result).toEqual(mockUser);
      });
    });

    describe('register', () => {
      it('should send json body with user data', async () => {
        const mockUser = { id: '1', email: 'test@example.com', name: 'Test' };
        const mockJsonFn = vi.fn().mockResolvedValue(mockUser);
        mockPost.mockReturnValue({
          json: mockJsonFn,
        });

        const result = await authApi.register('test@example.com', 'password123', 'Test User');

        expect(mockPost).toHaveBeenCalledWith('api/auth/register', {
          json: { email: 'test@example.com', password: 'password123', name: 'Test User' }
        });
        expect(mockJsonFn).toHaveBeenCalled();
        expect(result).toEqual(mockUser);
      });
    });
  });
});
