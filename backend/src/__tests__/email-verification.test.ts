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
  public lastMagicLinkEmail: { email: string; token: string; name: string } | null = null;
  public lastEmailChangeEmail: { email: string; token: string; name: string } | null = null;

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
  }

  async sendMagicLinkEmail(email: string, token: string, name: string): Promise<void> {
    this.lastMagicLinkEmail = { email, token, name };
  }

  async sendEmailChangeVerification(email: string, verificationToken: string, name: string): Promise<void> {
    this.lastEmailChangeEmail = { email, token: verificationToken, name };
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
    mockEmailService.lastMagicLinkEmail = null;
    mockEmailService.lastEmailChangeEmail = null;
  });

  describe('User Registration', () => {
    it('should generate magic link token on registration', async () => {
      const user = await authService.register(
        'verify@example.com',
        'Test User'
      );

      expect(user).toBeDefined();
      expect(user.magic_link_token).toBeDefined();
      expect(user.magic_link_token).toHaveLength(64); // 32 bytes hex = 64 chars
      expect(user.magic_link_token_expires_at).toBeDefined();
      expect(user.email_verified_at).toBeNull();

      // Verify expiration is ~24 hours in the future
      const expiresAt = user.magic_link_token_expires_at!;
      const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(hoursUntilExpiry).toBeGreaterThan(23.9);
      expect(hoursUntilExpiry).toBeLessThan(24.1);
    });

    it('should send welcome email with magic link', async () => {
      const user = await authService.register(
        'verify@example.com',
        'Test User'
      );

      // Give async email sending time to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEmailService.lastWelcomeEmail).toBeDefined();
      expect(mockEmailService.lastWelcomeEmail?.email).toBe('verify@example.com');
      expect(mockEmailService.lastWelcomeEmail?.name).toBe('Test User');
      expect(mockEmailService.lastWelcomeEmail?.token).toBe(user.magic_link_token);
    });
  });

  describe('Magic Link Verification', () => {
    it('should verify magic link and mark email as verified', async () => {
      // Register user
      const user = await authService.register(
        'verify@example.com',
        'Test User'
      );

      const token = user.magic_link_token!;
      expect(token).toBeDefined();

      // Verify magic link
      const verifiedUser = await authService.verifyMagicLink(token);
      expect(verifiedUser).toBeDefined();
      expect(verifiedUser!.email_verified_at).toBeDefined();

      // Check user is now verified in DB
      const dbUser = await userRepo.findOne({ 
        where: { email: 'verify@example.com' } 
      });
      expect(dbUser.email_verified_at).toBeDefined();
      expect(dbUser.magic_link_token).toBeNull();
      expect(dbUser.magic_link_token_expires_at).toBeNull();
    });

    it('should fail with invalid token', async () => {
      // Register user
      await authService.register(
        'verify@example.com',
        'Test User'
      );

      // Try with wrong token
      const invalidToken = crypto.randomBytes(32).toString('hex');
      const result = await authService.verifyMagicLink(invalidToken);
      expect(result).toBeNull();

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
        'Test User'
      );

      // Manually expire the token
      user.magic_link_token_expires_at = new Date(Date.now() - 1000); // 1 second ago
      await userRepo.save(user);

      const token = user.magic_link_token!;
      const result = await authService.verifyMagicLink(token);
      expect(result).toBeNull();

      // User should still be unverified
      const unverifiedUser = await userRepo.findOne({ 
        where: { email: 'verify@example.com' } 
      });
      expect(unverifiedUser.email_verified_at).toBeNull();
    });
  });

  describe('Email Verification (resend flow)', () => {
    it('should verify email with valid token for authenticated user', async () => {
      // Register user (not yet verified)
      const user = await authService.register(
        'verify@example.com',
        'Test User'
      );

      // Resend verification to generate email_verification_token (user is not yet verified)
      await authService.resendVerificationEmail('verify@example.com');

      // Get the new verification token from DB
      const dbUser = await userRepo.findOne({ where: { email: 'verify@example.com' } });
      const verificationToken = dbUser.email_verification_token;

      expect(verificationToken).toBeDefined();

      // Verify with the email_verification_token
      const success = await authService.verifyEmail(verificationToken, user.id);
      expect(success).toBe(true);

      // Check user is now verified
      const verifiedUser = await userRepo.findOne({ 
        where: { email: 'verify@example.com' } 
      });
      expect(verifiedUser.email_verified_at).toBeDefined();
    });

    it('should fail when token belongs to different user', async () => {
      // Register first user
      const user1 = await authService.register(
        'verify@example.com',
        'Test User 1'
      );

      // Register second user
      const user2 = await authService.register(
        'verify2@example.com',
        'Test User 2'
      );

      // Resend verification for user1 to generate email_verification_token
      await authService.resendVerificationEmail('verify@example.com');
      const dbUser1 = await userRepo.findOne({ where: { email: 'verify@example.com' } });
      const token = dbUser1.email_verification_token!;

      // Clear the mock to track new emails
      mockEmailService.lastSecurityNoticeEmail = null;

      // Try to verify user1's token while logged in as user2
      const result = await authService.verifyEmail(token, user2.id);
      
      // Should return wrong_user
      expect(result).toHaveProperty('error', 'wrong_user');
      
      // User1 should still be unverified
      const unverifiedUser1 = await userRepo.findOne({ 
        where: { email: 'verify@example.com' } 
      });
      expect(unverifiedUser1.email_verified_at).toBeNull();
      
      // A new verification token should have been generated for user1
      expect(unverifiedUser1.email_verification_token).not.toBeNull();
      expect(unverifiedUser1.email_verification_token).not.toBe(token);
      
      // Security notice email should have been sent
      const securityEmail = mockEmailService.lastSecurityNoticeEmail;
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
        'Test User'
      );

      const originalMagicToken = user.magic_link_token;
      
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
      // Register and verify user via magic link
      const user = await authService.register(
        'verify@example.com',
        'Test User'
      );

      await authService.verifyMagicLink(user.magic_link_token!);
      
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
    it('should complete full registration and magic link verification flow', async () => {
      // Step 1: Register
      const user = await authService.register(
        'verify@example.com',
        'Test User'
      );

      expect(user.email_verified_at).toBeNull();
      const magicLinkToken = user.magic_link_token!;

      // Step 2: Verify welcome email gets sent
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockEmailService.lastWelcomeEmail).toBeDefined();

      // Step 3: User clicks magic link to verify email and log in
      const verifiedUser = await authService.verifyMagicLink(magicLinkToken);
      expect(verifiedUser).toBeDefined();

      // Step 4: User is now verified
      const dbUser = await userRepo.findOne({ 
        where: { email: 'verify@example.com' } 
      });
      expect(dbUser.email_verified_at).toBeDefined();
      expect(dbUser.magic_link_token).toBeNull();
    });

    it('should allow requesting a new magic link after registration', async () => {
      // Register user
      const user = await authService.register(
        'verify@example.com',
        'Test User'
      );

      expect(user.email_verified_at).toBeNull();

      // Request a new magic link (simulating login flow)
      const result = await authService.requestMagicLink('verify@example.com');
      expect(result).toBeDefined();

      // Verify a new magic link token was generated
      const updatedUser = await userRepo.findOne({ 
        where: { email: 'verify@example.com' } 
      });
      expect(updatedUser.magic_link_token).toBeDefined();
      
      // Magic link email should have been sent
      expect(mockEmailService.lastMagicLinkEmail).toBeDefined();
      expect(mockEmailService.lastMagicLinkEmail?.email).toBe('verify@example.com');
    });
  });
});
