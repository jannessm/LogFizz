import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { IsNull, MoreThan } from 'typeorm';
import { EmailService } from './email.service.js';
import crypto from 'crypto';

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private emailService = new EmailService();

  async register(email: string, password: string, name: string,
                 country?: string, state?: string): Promise<User> {
    const existingUser = await this.userRepository.findOne({ where: { email, deleted_at: IsNull() } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const password_hash = await hashPassword(password);
    const user = this.userRepository.create({
      email,
      password_hash,
      name,
      country,
      state,
    });

    return this.userRepository.save(user);
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

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = await this.getUserById(id);
    if (!user) {
      return null;
    }

    Object.assign(user, updates);
    return this.userRepository.save(user);
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
}
