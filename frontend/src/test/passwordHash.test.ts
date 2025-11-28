import { describe, it, expect } from 'vitest';
import { hashPasswordForTransport } from '../../../lib/utils/passwordHash.browser.js';

describe('Password Hash Utility', () => {
  it('should produce a deterministic hash', async () => {
    const password = 'testpassword123';
    const email = 'test@example.com';
    
    const hash1 = await hashPasswordForTransport(password, email);
    const hash2 = await hashPasswordForTransport(password, email);
    
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different passwords', async () => {
    const email = 'test@example.com';
    
    const hash1 = await hashPasswordForTransport('password1', email);
    const hash2 = await hashPasswordForTransport('password2', email);
    
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes for different emails', async () => {
    const password = 'testpassword123';
    
    const hash1 = await hashPasswordForTransport(password, 'user1@example.com');
    const hash2 = await hashPasswordForTransport(password, 'user2@example.com');
    
    expect(hash1).not.toBe(hash2);
  });

  it('should normalize email to lowercase', async () => {
    const password = 'testpassword123';
    
    const hash1 = await hashPasswordForTransport(password, 'User@Example.COM');
    const hash2 = await hashPasswordForTransport(password, 'user@example.com');
    
    expect(hash1).toBe(hash2);
  });

  it('should trim whitespace from email', async () => {
    const password = 'testpassword123';
    
    const hash1 = await hashPasswordForTransport(password, '  test@example.com  ');
    const hash2 = await hashPasswordForTransport(password, 'test@example.com');
    
    expect(hash1).toBe(hash2);
  });

  it('should produce a 64-character hex string', async () => {
    const password = 'testpassword123';
    const email = 'test@example.com';
    
    const hash = await hashPasswordForTransport(password, email);
    
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
