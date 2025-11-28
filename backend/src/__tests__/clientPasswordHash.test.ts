import { describe, it, expect } from 'vitest';
import { hashPasswordForTransport } from '../../../lib/utils/passwordHash.node.js';

describe('Client Password Hash Utility', () => {
  it('should produce a deterministic hash', () => {
    const password = 'testpassword123';
    const email = 'test@example.com';
    
    const hash1 = hashPasswordForTransport(password, email);
    const hash2 = hashPasswordForTransport(password, email);
    
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different passwords', () => {
    const email = 'test@example.com';
    
    const hash1 = hashPasswordForTransport('password1', email);
    const hash2 = hashPasswordForTransport('password2', email);
    
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes for different emails', () => {
    const password = 'testpassword123';
    
    const hash1 = hashPasswordForTransport(password, 'user1@example.com');
    const hash2 = hashPasswordForTransport(password, 'user2@example.com');
    
    expect(hash1).not.toBe(hash2);
  });

  it('should handle email case insensitivity', () => {
    const password = 'testpassword123';
    
    const hash1 = hashPasswordForTransport(password, 'Test@Example.COM');
    const hash2 = hashPasswordForTransport(password, 'test@example.com');
    
    expect(hash1).toBe(hash2);
  });

  it('should handle email whitespace', () => {
    const password = 'testpassword123';
    
    const hash1 = hashPasswordForTransport(password, ' test@example.com ');
    const hash2 = hashPasswordForTransport(password, 'test@example.com');
    
    expect(hash1).toBe(hash2);
  });

  it('should produce a hex string of expected length', () => {
    const hash = hashPasswordForTransport('testpassword123', 'test@example.com');
    
    // SHA-256 produces 64 hex characters
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
