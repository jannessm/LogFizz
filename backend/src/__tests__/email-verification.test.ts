import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AppDataSource } from '../config/database.js';
import { AuthService } from '../services/auth.service.js';
import { EmailService } from '../services/email.service.js';
import { User } from '../entities/User.js';
import crypto from 'crypto';

// Mock email service
class MockEmailService extends EmailService {
  public lastWelcomeEmail: { email: string; token: string; name: string } | null = null;
  public lastSecurityNoticeEmail: { email: string; token: string; name: string; attemptedBy: string } | null = null;

  async sendWelcomeEmail(email: string, token: string, name: string): Promise<void> {
    this.lastWelcomeEmail = { email, token, name };
    // Don't actually send email in tests
  }

  async sendVerificationWithSecurityNotice(
    email: string, 
    token: string, 
    name: string, 
    attemptedByEmail: string
  ): Promise<void> {
    this.lastSecurityNoticeEmail = { email, token, name, attemptedBy: attemptedByEmail };
    // Don't actually send email in tests
  }
}

describe('Email Verification', () => {
  let authService: AuthService;
  let mockEmailService: MockEmailService;
  let userRepo: any;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    
    authService = new AuthService();
    mockEmailService = new MockEmailService();
    userRepo = AppDataSource.getRepository(User);
    
    // Replace email service with mock
    (authService as any).emailService = mockEmailService;
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clean up test users
    await userRepo.delete({ email: 'verify@example.com' });
    await userRepo.delete({ email: 'verify2@example.com' });
    mockEmailService.lastWelcomeEmail = null;
    mockEmailService.lastSecurityNoticeEmail = null;
  });

  describe('User Registration', () => {
    it('should generate verification token on registration', async () => {
      const user = await authService.register(
        'verify@example.com',
        'password123',
        'Test User'
      );

      expect(user).toBeDefined();
      expect(user.email_verification_token).toBeDefined();
      expect(user.email_verification_token).toHaveLength(64); // 32 bytes hex = 64 chars
      expect(user.email_verification_expires_at).toBeDefined();
      expect(user.email_verified_at).toBeNull();

      // Verify expiration is ~24 hours in the future
      const expiresAt = user.email_verification_expires_at!;
      const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(hoursUntilExpiry).toBeGreaterThan(23.9);
      expect(hoursUntilExpiry).toBeLessThan(24.1);
    });

    it('should send welcome email with verification link', async () => {
      const user = await authService.register(
        'verify@example.com',
        'password123',
        'Test User'
      );

      // Give async email sending time to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEmailService.lastWelcomeEmail).toBeDefined();
      expect(mockEmailService.lastWelcomeEmail?.email).toBe('verify@example.com');
      expect(mockEmailService.lastWelcomeEmail?.name).toBe('Test User');
      expect(mockEmailService.lastWelcomeEmail?.token).toBe(user.email_verification_token);
    });
  });

  describe('Email Verification', () => {
    it('should verify email with valid token for authenticated user', async () => {
      // Register user
      const user = await authService.register(
        'verify@example.com',
        'password123',
        'Test User'
      );

      const token = user.email_verification_token!;
      expect(token).toBeDefined();

      // Verify email with correct user
      const success = await authService.verifyEmail(token, user.id);
      expect(success).toBe(true);

      // Check user is now verified
      const verifiedUser = await userRepo.findOne({ 
        where: { email: 'verify@example.com' } 
      });
      expect(verifiedUser.email_verified_at).toBeDefined();
      expect(verifiedUser.email_verification_token).toBeNull();
      expect(verifiedUser.email_verification_expires_at).toBeNull();
    });

    it('should fail with invalid token', async () => {
      // Register user
      const user = await authService.register(
        'verify@example.com',
        'password123',
        'Test User'
      );

      // Try with wrong token
      const invalidToken = crypto.randomBytes(32).toString('hex');
      const success = await authService.verifyEmail(invalidToken, user.id);
      expect(success).toBe(false);

      // User should still be unverified
      const unverifiedUser = await userRepo.findOne({ 
        where: { email: 'verify@example.com' } 
      });
      expect(unverifiedUser.email_verified_at).toBeNull();
    });

    it('should fail with expired token', async () => {
      // Register user
      const user = await authService.register(
        'verify@example.com',
        'password123',
        'Test User'
      );

      // Manually expire the token
      user.email_verification_expires_at = new Date(Date.now() - 1000); // 1 second ago
      await userRepo.save(user);

      const token = user.email_verification_token!;
      const success = await authService.verifyEmail(token, user.id);
      expect(success).toBe(false);

      // User should still be unverified
      const unverifiedUser = await userRepo.findOne({ 
        where: { email: 'verify@example.com' } 
      });
      expect(unverifiedUser.email_verified_at).toBeNull();
    });

    it('should fail when token belongs to different user', async () => {
      // Register first user
      const user1 = await authService.register(
        'verify@example.com',
        'password123',
        'Test User 1'
      );

      // Register second user
      const user2 = await authService.register(
        'verify2@example.com',
        'password456',
        'Test User 2'
      );

      const token = user1.email_verification_token!;
      const originalToken = token;

      // Clear the mock to track new emails
      mockEmailService.lastSecurityNoticeEmail = null;

      // Try to verify user1's token while logged in as user2
      const result = await authService.verifyEmail(token, user2.id);
      
      // Should return wrong_user with masked email
      expect(result).toHaveProperty('error', 'wrong_user');
      
      // User1 should still be unverified
      const unverifiedUser1 = await userRepo.findOne({ 
        where: { email: 'verify@example.com' } 
      });
      expect(unverifiedUser1.email_verified_at).toBeNull();
      
      // A new verification token should have been generated for user1
      expect(unverifiedUser1.email_verification_token).not.toBeNull();
      expect(unverifiedUser1.email_verification_token).not.toBe(originalToken);
      
      // Security notice email should have been sent
      const securityEmail = mockEmailService.lastSecurityNoticeEmail as { email: string; token: string; name: string; attemptedBy: string } | null;
      expect(securityEmail).toBeDefined();
      expect(securityEmail!.email).toBe('verify@example.com');
      expect(securityEmail!.name).toBe('Test User 1');
      expect(securityEmail!.attemptedBy).toBe('verify2@example.com');
      expect(securityEmail!.token).toBe(unverifiedUser1.email_verification_token);
      
      // Clean up user2
      await userRepo.delete({ email: 'verify2@example.com' });
    });
  });

  describe('Resend Verification Email', () => {
    it('should generate new token and resend email', async () => {
      // Register user
      const user = await authService.register(
        'verify@example.com',
        'password123',
        'Test User'
      );

      const originalToken = user.email_verification_token;
      
      // Clear mock
      mockEmailService.lastWelcomeEmail = null;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Resend verification
      const success = await authService.resendVerificationEmail('verify@example.com');
      expect(success).toBe(true);

      // Check new token was generated
      const updatedUser = await userRepo.findOne({ 
        where: { email: 'verify@example.com' } 
      });
      expect(updatedUser.email_verification_token).toBeDefined();
      expect(updatedUser.email_verification_token).not.toBe(originalToken);

      // Check email was sent with new token
      expect(mockEmailService.lastWelcomeEmail).toBeDefined();
      expect(mockEmailService.lastWelcomeEmail!.token).toBe(updatedUser.email_verification_token);
    });

    it('should not reveal if email does not exist', async () => {
      const success = await authService.resendVerificationEmail('nonexistent@example.com');
      
      // Should still return true to prevent email enumeration
      expect(success).toBe(true);
      
      // No email should be sent
      expect(mockEmailService.lastWelcomeEmail).toBeNull();
    });

    it('should not resend if email already verified', async () => {
      // Register and verify user
      const user = await authService.register(
        'verify@example.com',
        'password123',
        'Test User'
      );

      await authService.verifyEmail(user.email_verification_token!, user.id);
      
      // Clear mock
      mockEmailService.lastWelcomeEmail = null;

      // Try to resend
      const success = await authService.resendVerificationEmail('verify@example.com');
      expect(success).toBe(true);

      // No email should be sent for already verified users
      expect(mockEmailService.lastWelcomeEmail).toBeNull();
    });
  });

  describe('Complete Flow', () => {
    it('should complete full registration and verification flow', async () => {
      // Step 1: Register
      const user = await authService.register(
        'verify@example.com',
        'password123',
        'Test User'
      );

      expect(user.email_verified_at).toBeNull();
      const verificationToken = user.email_verification_token!;

      // Step 2: Verify email gets sent
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockEmailService.lastWelcomeEmail).toBeDefined();

      // Step 3: User clicks verification link (must be logged in as the same user)
      const verificationSuccess = await authService.verifyEmail(verificationToken, user.id);
      expect(verificationSuccess).toBe(true);

      // Step 4: User is now verified and can login
      const verifiedUser = await userRepo.findOne({ 
        where: { email: 'verify@example.com' } 
      });
      expect(verifiedUser.email_verified_at).toBeDefined();
      expect(verifiedUser.email_verification_token).toBeNull();

      // Step 5: User can login normally
      const loginUser = await authService.login('verify@example.com', 'password123');
      expect(loginUser).toBeDefined();
      expect(loginUser?.email).toBe('verify@example.com');
    });

    it('should allow login even without email verification', async () => {
      // Register user
      const user = await authService.register(
        'verify@example.com',
        'password123',
        'Test User'
      );

      expect(user.email_verified_at).toBeNull();

      // User can still login (email verification is optional for now)
      const loginUser = await authService.login('verify@example.com', 'password123');
      expect(loginUser).toBeDefined();
      expect(loginUser?.email).toBe('verify@example.com');
    });
  });
});
