import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { IsNull, MoreThan } from 'typeorm';
import { EmailService } from './email.service.js';
import crypto from 'crypto';

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private emailService = new EmailService();

  /**
   * Register a new user (no password required)
   */
  async register(email: string, name: string, state?: string): Promise<User> {
    const existingUser = await this.userRepository.findOne({ where: { email, deleted_at: IsNull() } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const user = this.userRepository.create({
      email,
      name,
      state,
    });

    return this.userRepository.save(user);
  }

  /**
   * Request a login code to be sent via email
   */
  async requestLoginCode(email: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { email, deleted_at: IsNull() } });
    
    // Don't reveal if user exists or not for security reasons
    if (!user) {
      return true;
    }

    // Generate a 6-digit code
    const loginCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Code expires in 15 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    user.login_code = loginCode;
    user.login_code_expires_at = expiresAt;
    await this.userRepository.save(user);

    // Send login code email
    try {
      await this.emailService.sendLoginCode(user.email, loginCode, user.name);
    } catch (error) {
      console.error('Failed to send login code email:', error);
      // Don't throw error to not reveal if user exists
    }

    return true;
  }

  /**
   * Verify login code and return user if valid
   */
  async verifyLoginCode(email: string, code: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: {
        email,
        login_code: code,
        login_code_expires_at: MoreThan(new Date()),
        deleted_at: IsNull(),
      },
    });

    if (!user) {
      return null;
    }

    // Clear the login code after successful verification
    user.login_code = null as any;
    user.login_code_expires_at = null as any;
    await this.userRepository.save(user);

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
}
