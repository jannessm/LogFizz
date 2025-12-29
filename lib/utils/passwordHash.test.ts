/**
 * Tests for password hashing utilities
 */

import { describe, it, expect } from 'vitest';
import { hashPasswordForTransport } from './passwordHash.js';

describe('hashPasswordForTransport', () => {
  describe('Basic Functionality', () => {
    it('should return a hex string', async () => {
      const result = await hashPasswordForTransport('password123', 'user@example.com');
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[0-9a-f]{64}$/); // SHA-256 produces 64 hex characters
    });

    it('should return a 64-character hex string (SHA-256)', async () => {
      const result = await hashPasswordForTransport('mypassword', 'test@test.com');
      
      expect(result.length).toBe(64);
    });

    it('should produce valid hex output (only 0-9 and a-f)', async () => {
      const result = await hashPasswordForTransport('test', 'email@test.com');
      
      expect(result).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('Deterministic Behavior', () => {
    it('should produce the same hash for the same password and email', async () => {
      const password = 'MySecurePassword123';
      const email = 'user@example.com';
      
      const hash1 = await hashPasswordForTransport(password, email);
      const hash2 = await hashPasswordForTransport(password, email);
      
      expect(hash1).toBe(hash2);
    });

    it('should be consistent across multiple calls', async () => {
      const password = 'testpass';
      const email = 'test@test.com';
      
      const hashes = await Promise.all(
        Array.from({ length: 10 }, () => hashPasswordForTransport(password, email))
      );
      
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1); // All hashes should be identical
    });
  });

  describe('Email Normalization', () => {
    it('should normalize email to lowercase', async () => {
      const password = 'password123';
      
      const hash1 = await hashPasswordForTransport(password, 'User@Example.COM');
      const hash2 = await hashPasswordForTransport(password, 'user@example.com');
      
      expect(hash1).toBe(hash2);
    });

    it('should trim whitespace from email', async () => {
      const password = 'password123';
      
      const hash1 = await hashPasswordForTransport(password, '  user@example.com  ');
      const hash2 = await hashPasswordForTransport(password, 'user@example.com');
      
      expect(hash1).toBe(hash2);
    });

    it('should handle mixed case and whitespace together', async () => {
      const password = 'password123';
      
      const hash1 = await hashPasswordForTransport(password, '  User@Example.COM  ');
      const hash2 = await hashPasswordForTransport(password, 'user@example.com');
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('Different Inputs Produce Different Hashes', () => {
    it('should produce different hashes for different passwords', async () => {
      const email = 'user@example.com';
      
      const hash1 = await hashPasswordForTransport('password1', email);
      const hash2 = await hashPasswordForTransport('password2', email);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different emails', async () => {
      const password = 'password123';
      
      const hash1 = await hashPasswordForTransport(password, 'user1@example.com');
      const hash2 = await hashPasswordForTransport(password, 'user2@example.com');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes when both password and email differ', async () => {
      const hash1 = await hashPasswordForTransport('password1', 'user1@example.com');
      const hash2 = await hashPasswordForTransport('password2', 'user2@example.com');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for similar but not identical passwords', async () => {
      const email = 'user@example.com';
      
      const hash1 = await hashPasswordForTransport('password', email);
      const hash2 = await hashPasswordForTransport('password1', email);
      const hash3 = await hashPasswordForTransport('Password', email);
      
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty password', async () => {
      const result = await hashPasswordForTransport('', 'user@example.com');
      
      expect(result).toBeTruthy();
      expect(result.length).toBe(64);
    });

    it('should handle empty email', async () => {
      const result = await hashPasswordForTransport('password123', '');
      
      expect(result).toBeTruthy();
      expect(result.length).toBe(64);
    });

    it('should handle both empty password and email', async () => {
      const result = await hashPasswordForTransport('', '');
      
      expect(result).toBeTruthy();
      expect(result.length).toBe(64);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(10000);
      const result = await hashPasswordForTransport(longPassword, 'user@example.com');
      
      expect(result).toBeTruthy();
      expect(result.length).toBe(64);
    });

    it('should handle very long emails', async () => {
      const longEmail = 'a'.repeat(1000) + '@example.com';
      const result = await hashPasswordForTransport('password', longEmail);
      
      expect(result).toBeTruthy();
      expect(result.length).toBe(64);
    });

    it('should handle special characters in password', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const result = await hashPasswordForTransport(specialPassword, 'user@example.com');
      
      expect(result).toBeTruthy();
      expect(result.length).toBe(64);
    });

    it('should handle unicode characters in password', async () => {
      const unicodePassword = '密码🔐🎉😀';
      const result = await hashPasswordForTransport(unicodePassword, 'user@example.com');
      
      expect(result).toBeTruthy();
      expect(result.length).toBe(64);
    });

    it('should handle unicode characters in email', async () => {
      const unicodeEmail = 'user@例え.com';
      const result = await hashPasswordForTransport('password', unicodeEmail);
      
      expect(result).toBeTruthy();
      expect(result.length).toBe(64);
    });
  });

  describe('Security Properties', () => {
    it('should not reveal password length through hash', async () => {
      const email = 'user@example.com';
      
      const shortHash = await hashPasswordForTransport('pw', email);
      const longHash = await hashPasswordForTransport('a'.repeat(100), email);
      
      expect(shortHash.length).toBe(longHash.length);
      expect(shortHash.length).toBe(64);
    });

    it('should produce significantly different hashes for small password changes', async () => {
      const email = 'user@example.com';
      
      const hash1 = await hashPasswordForTransport('password', email);
      const hash2 = await hashPasswordForTransport('passwor', email); // One char less
      
      expect(hash1).not.toBe(hash2);
      
      // Count differing characters (should be significant, not just 1-2)
      let differences = 0;
      for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) differences++;
      }
      
      // SHA-256 should produce avalanche effect - many chars should differ
      expect(differences).toBeGreaterThan(20);
    });

    it('should use email as salt (same password + different email = different hash)', async () => {
      const password = 'commonpassword';
      
      const hash1 = await hashPasswordForTransport(password, 'alice@example.com');
      const hash2 = await hashPasswordForTransport(password, 'bob@example.com');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle typical registration scenario', async () => {
      const userEmail = 'newuser@example.com';
      const userPassword = 'MySecurePass123!';
      
      const hash = await hashPasswordForTransport(userPassword, userEmail);
      
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle typical login scenario with same credentials', async () => {
      const email = 'user@example.com';
      const password = 'LoginPass456!';
      
      // Simulate registration
      const registrationHash = await hashPasswordForTransport(password, email);
      
      // Simulate login (should produce same hash)
      const loginHash = await hashPasswordForTransport(password, email);
      
      expect(loginHash).toBe(registrationHash);
    });

    it('should reject wrong password during login', async () => {
      const email = 'user@example.com';
      const correctPassword = 'CorrectPass123!';
      const wrongPassword = 'WrongPass456!';
      
      const correctHash = await hashPasswordForTransport(correctPassword, email);
      const wrongHash = await hashPasswordForTransport(wrongPassword, email);
      
      expect(wrongHash).not.toBe(correctHash);
    });

    it('should handle password reset scenario', async () => {
      const email = 'user@example.com';
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword456!';
      
      const oldHash = await hashPasswordForTransport(oldPassword, email);
      const newHash = await hashPasswordForTransport(newPassword, email);
      
      expect(newHash).not.toBe(oldHash);
      expect(newHash.length).toBe(64);
    });
  });

  describe('Regression Tests', () => {
    it('should produce expected hash for known input (regression test)', async () => {
      // This test ensures the hash function doesn't change unexpectedly
      const password = 'testpassword123';
      const email = 'test@example.com';
      
      const hash = await hashPasswordForTransport(password, email);
      
      // This is the expected hash for this specific input
      // If this test fails after an update, it means the hashing changed
      // and all existing passwords would become invalid!
      // Hash = SHA256(password + email) where password='testpassword123' and email='test@example.com'
      expect(hash).toBe('0df4d24d1d176c812170c4f5ac2561df922e122ab93d1cd83d01e938d0568ecd');
    });

    it('should handle case where user types email in different case on login', async () => {
      const password = 'password123';
      
      // User registers with lowercase
      const registrationHash = await hashPasswordForTransport(password, 'user@example.com');
      
      // User logs in with uppercase
      const loginHash = await hashPasswordForTransport(password, 'USER@EXAMPLE.COM');
      
      expect(loginHash).toBe(registrationHash);
    });
  });

  describe('Type Safety', () => {
    it('should accept string password and email', async () => {
      await expect(hashPasswordForTransport('password', 'email@test.com')).resolves;
    });

    it('should return a string', async () => {
      const result = await hashPasswordForTransport('test', 'test@test.com');
      expect(typeof result).toBe('string');
    });
  });
});
