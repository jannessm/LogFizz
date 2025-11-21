import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { State } from '../entities/State.js';
import { UserStateEntry } from '../entities/UserStateEntry.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { IsNull, MoreThan } from 'typeorm';
import { EmailService } from './email.service.js';
import { UserStateEntryService } from './user-state-entry.service.js';
import crypto from 'crypto';

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private stateRepository = AppDataSource.getRepository(State);
  private stateEntryRepository = AppDataSource.getRepository(UserStateEntry);
  private emailService = new EmailService();
  private stateEntryService = new UserStateEntryService();

  async register(
    email: string, 
    password: string, 
    name: string,
    state?: string,
  ): Promise<User> {
    const existingUser = await this.userRepository.findOne({ where: { email, deleted_at: IsNull() } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const password_hash = await hashPassword(password);
    const stateEntries: Array<{ id: string; registered_at: Date | string }> = [];
    if (state) {
      const stateEntry = await this.stateRepository.findOne({
        where: { code: state }
      });
      if (stateEntry) {
        stateEntries.push({ id: stateEntry.id, registered_at: new Date() });
      }
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date();
    verificationExpiresAt.setHours(verificationExpiresAt.getHours() + 24); // 24 hours expiry

    const user = this.userRepository.create({
      email,
      password_hash,
      name,
      email_verification_token: verificationToken,
      email_verification_expires_at: verificationExpiresAt,
    });

    const newUser = await this.userRepository.save(user);

    // Create state entries if provided
    if (stateEntries && stateEntries.length > 0) {
      for (const entry of stateEntries) {
        const registeredAt = typeof entry.registered_at === 'string' 
          ? new Date(entry.registered_at) 
          : entry.registered_at;
        
        await this.stateEntryService.createStateEntry(
          newUser.id,
          entry.id,
          registeredAt
        );
      }
    }

    // Send welcome email with verification link (async, don't wait)
    this.emailService.sendWelcomeEmail(newUser.email, verificationToken, newUser.name)
      .catch(error => console.error('Failed to send welcome email:', error));

    return newUser;
  }

  async login(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email, deleted_at: IsNull() } });
    if (!user) {
      return null;
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id, deleted_at: IsNull() } });
  }

  async getUserWithStateEntries(id: string): Promise<User & { state_entries?: UserStateEntry[] } | null> {
    const user = await this.getUserById(id);
    if (!user) {
      return null;
    }

    const stateEntries = await this.stateEntryService.getStateEntriesByUser(id);
    return { ...user, state_entries: stateEntries };
  }

  async updateUser(
    id: string, 
    updates: Partial<User>,
    stateEntries?: Array<{ id?: string; state_id: string; registered_at: Date | string }>
  ): Promise<User | null> {
    const user = await this.getUserById(id);
    if (!user) {
      return null;
    }

    Object.assign(user, updates);
    const updatedUser = await this.userRepository.save(user);

    // Handle state entries if provided
    if (stateEntries !== undefined) {
      // Get existing entries
      const existingEntries = await this.stateEntryService.getStateEntriesByUser(id);
      const existingIds = new Set(existingEntries.map(e => e.id));

      // Update or create entries
      for (const entry of stateEntries) {
        const registeredAt = typeof entry.registered_at === 'string' 
          ? new Date(entry.registered_at) 
          : entry.registered_at;

        if (entry.id && existingIds.has(entry.id)) {
          // Update existing entry
          await this.stateEntryService.updateStateEntry(id, entry.id, {
            state_id: entry.state_id,
            registered_at: registeredAt,
          });
          existingIds.delete(entry.id);
        } else {
          // Create new entry
          await this.stateEntryService.createStateEntry(
            id,
            entry.state_id,
            registeredAt
          );
        }
      }

      // Delete entries that weren't in the update (soft delete)
      for (const entryId of existingIds) {
        await this.stateEntryService.deleteStateEntry(id, entryId);
      }
    }

    return updatedUser;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) {
      return false;
    }

    const isValid = await verifyPassword(oldPassword, user.password_hash);
    if (!isValid) {
      return false;
    }

    user.password_hash = await hashPassword(newPassword);
    await this.userRepository.save(user);
    return true;
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { email, deleted_at: IsNull() } });
    
    // Don't reveal if user exists or not for security reasons
    if (!user) {
      return true;
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Token expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    user.reset_token = resetToken;
    user.reset_token_expires_at = expiresAt;
    await this.userRepository.save(user);

    // Send password reset email
    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetToken, user.name);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      // Don't throw error to not reveal if user exists
    }

    return true;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: {
        reset_token: token,
        reset_token_expires_at: MoreThan(new Date()),
        deleted_at: IsNull(),
      },
    });

    if (!user) {
      return false;
    }

    // Update password and clear reset token
    user.password_hash = await hashPassword(newPassword);
    user.reset_token = null as any;
    user.reset_token_expires_at = null as any;
    await this.userRepository.save(user);

    return true;
  }

  async verifyEmail(token: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: {
        email_verification_token: token,
        email_verification_expires_at: MoreThan(new Date()),
        deleted_at: IsNull(),
      },
    });

    if (!user) {
      return false;
    }

    // Mark email as verified and clear verification token
    user.email_verified_at = new Date();
    user.email_verification_token = null as any;
    user.email_verification_expires_at = null as any;
    await this.userRepository.save(user);

    return true;
  }

  async resendVerificationEmail(email: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ 
      where: { email, deleted_at: IsNull() } 
    });

    // Don't reveal if user exists
    if (!user) {
      return true;
    }

    // Don't resend if already verified
    if (user.email_verified_at) {
      return true;
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date();
    verificationExpiresAt.setHours(verificationExpiresAt.getHours() + 24);

    user.email_verification_token = verificationToken;
    user.email_verification_expires_at = verificationExpiresAt;
    await this.userRepository.save(user);

    // Send verification email
    try {
      await this.emailService.sendWelcomeEmail(user.email, verificationToken, user.name);
    } catch (error) {
      console.error('Failed to resend verification email:', error);
    }

    return true;
  }
}
