import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { Timer } from '../entities/Timer.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Target } from '../entities/Target.js';
import { TargetSpec } from '../entities/TargetSpec.js';
import { Balance } from '../entities/Balance.js';
import { UserSettings } from '../entities/UserSettings.js';
import { IsNull, MoreThan } from 'typeorm';
import { EmailService } from './email.service.js';
import crypto from 'crypto';

// Repositories used only for example-data creation (lazily accessed)
const targetRepo = () => AppDataSource.getRepository(Target);
const targetSpecRepo = () => AppDataSource.getRepository(TargetSpec);
const timerRepo = () => AppDataSource.getRepository(Timer);

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private emailService = new EmailService();

  async register(
    email: string, 
    name: string,
  ): Promise<User> {
    const existingUser = await this.userRepository.findOne({ where: { email, deleted_at: IsNull() } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Generate magic link token - serves as email verification on first login
    const magicLinkToken = crypto.randomBytes(32).toString('hex');
    const magicLinkExpiresAt = new Date();
    magicLinkExpiresAt.setHours(magicLinkExpiresAt.getHours() + 24); // 24 hours for registration link

    // Set trial end date to 2 months from now
    const trialEndDate = new Date();
    trialEndDate.setMonth(trialEndDate.getMonth() + 2);

    const user = this.userRepository.create({
      email,
      name,
      magic_link_token: magicLinkToken,
      magic_link_token_expires_at: magicLinkExpiresAt,
      subscription_status: 'trial',
      trial_end_date: trialEndDate,
    });

    await this.userRepository.save(user);
    // Reload to get auto-generated timestamps
    const newUser = await this.userRepository.findOne({ where: { id: user.id } });
    if (!newUser) throw new Error('Failed to create user');

    // Send welcome email with magic link (serves as verification + first login)
    if (process.env.MAGIC_LINK_DISABLED !== 'true') {
      this.emailService.sendWelcomeEmail(newUser.email, magicLinkToken, newUser.name)
        .catch(error => console.error('Failed to send welcome email:', error));
    } else {
      console.log(`[DEV] Magic link disabled – registration token for ${newUser.email}: ${magicLinkToken}`);
    }

    // Create example target and timer so the user has something to start with
    this.createExampleData(newUser.id)
      .catch(error => console.error('Failed to create example data for new user:', error));

    return newUser;
  }

  /**
   * When MAGIC_LINK_DISABLED=true, returns the registration magic link token
   * for use in development without email sending.
   */
  getDevRegistrationToken(user: User): string | undefined {
    if (process.env.MAGIC_LINK_DISABLED === 'true') {
      return user.magic_link_token ?? undefined;
    }
    return undefined;
  }

  /**
   * Creates an example "Work" target with a standard Mon–Fri 8 h/day spec
   * and a linked "Work" timer button for a newly registered user.
   */
  private async createExampleData(userId: string): Promise<void> {
    // Target
    const target = targetRepo().create({
      user_id: userId,
      name: 'Work',
      target_spec_ids: [],
    });
    await targetRepo().save(target);

    // TargetSpec: Mon–Fri 8 h (480 min), no holidays exclusion, starting from today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const spec = targetSpecRepo().create({
      user_id: userId,
      target_id: target.id,
      // Sun=0, Mon=480, Tue=480, Wed=480, Thu=480, Fri=480, Sat=0
      duration_minutes: [0, 480, 480, 480, 480, 480, 0],
      starting_from: today,
      exclude_holidays: false,
    });
    await targetSpecRepo().save(spec);

    target.target_spec_ids = [spec.id];
    await targetRepo().save(target);

    // Timer (button)
    const timer = timerRepo().create({
      user_id: userId,
      name: 'Work',
      emoji: '💼',
      color: '#3B82F6',
      target_id: target.id,
      auto_subtract_breaks: true,
      archived: false,
    });
    await timerRepo().save(timer);
  }

  async requestMagicLink(email: string): Promise<{ token?: string }> {
    const user = await this.userRepository.findOne({ where: { email, deleted_at: IsNull() } });
    
    // Don't reveal if user exists or not for security reasons
    if (!user) {
      return {};
    }

    // Generate a secure magic link token
    const magicLinkToken = crypto.randomBytes(32).toString('hex');
    
    // Token expires in 15 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    user.magic_link_token = magicLinkToken;
    user.magic_link_token_expires_at = expiresAt;
    await this.userRepository.save(user);

    // Send magic link email
    if (process.env.MAGIC_LINK_DISABLED === 'true') {
      console.log(`[DEV] Magic link disabled – token for ${email}: ${magicLinkToken}`);
      return { token: magicLinkToken };
    }

    try {
      await this.emailService.sendMagicLinkEmail(user.email, magicLinkToken, user.name);
    } catch (error) {
      console.error('Failed to send magic link email:', error);
      // Don't throw error to not reveal if user exists
    }

    return {};
  }

  async verifyMagicLink(token: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: {
        magic_link_token: token,
        magic_link_token_expires_at: MoreThan(new Date()),
        deleted_at: IsNull(),
      },
    });

    if (!user) {
      return null;
    }

    // Mark email as verified if not already (magic link serves as email verification)
    if (!user.email_verified_at) {
      user.email_verified_at = new Date();
    }

    // Clear magic link token
    user.magic_link_token = null as any;
    user.magic_link_token_expires_at = null as any;
    // Also clear any old verification tokens
    user.email_verification_token = null as any;
    user.email_verification_expires_at = null as any;
    await this.userRepository.save(user);

    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id, deleted_at: IsNull() } });
  }

  async updateUser(
    id: string, 
    updates: Partial<User>,
  ): Promise<User | null> {
    const user = await this.getUserById(id);
    if (!user) {
      return null;
    }

    Object.assign(user, updates);
    await this.userRepository.save(user);
    // Reload to get auto-generated timestamps
    const updatedUser = await this.userRepository.findOne({ where: { id: user.id } });

    return updatedUser;
  }

  async requestEmailChange(userId: string, newEmail: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) {
      return false;
    }

    // Check if the new email is already in use
    const existingUser = await this.userRepository.findOne({ where: { email: newEmail, deleted_at: IsNull() } });
    if (existingUser) {
      throw new Error('EMAIL_ALREADY_IN_USE');
    }

    // Generate email change verification token
    const changeToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    user.pending_email = newEmail;
    user.email_change_token = changeToken;
    user.email_change_token_expires_at = expiresAt;
    await this.userRepository.save(user);

    // Send verification email to the NEW email address
    try {
      await this.emailService.sendEmailChangeVerification(newEmail, changeToken, user.name);
    } catch (error) {
      console.error('Failed to send email change verification:', error);
      throw new Error('Failed to send verification email');
    }

    return true;
  }

  async verifyEmailChange(token: string, userId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        email_change_token: token,
        email_change_token_expires_at: MoreThan(new Date()),
        deleted_at: IsNull(),
      },
    });

    if (!user || !user.pending_email) {
      return null;
    }

    // Check if the pending email is still available
    const existingUser = await this.userRepository.findOne({ where: { email: user.pending_email, deleted_at: IsNull() } });
    if (existingUser) {
      return null;
    }

    // Apply the email change
    user.email = user.pending_email;
    user.pending_email = null as any;
    user.email_change_token = null as any;
    user.email_change_token_expires_at = null as any;
    await this.userRepository.save(user);

    return user;
  }

  async verifyEmail(token: string, userId: string): Promise<boolean | { error: 'wrong_user' }> {
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

    // Check if the token belongs to the authenticated user
    if (user.id !== userId) {
      // The wrong user is logged in and clicked this link.
      // Resend a fresh verification email to the token's owner so they can verify later.
      const newVerificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpiresAt = new Date();
      verificationExpiresAt.setHours(verificationExpiresAt.getHours() + 24);

      user.email_verification_token = newVerificationToken;
      user.email_verification_expires_at = verificationExpiresAt;
      await this.userRepository.save(user);

      // Get the currently-logged-in (wrong) user's email for the security notice
      const authenticatedUser = await this.getUserById(userId);
      const attemptedByEmail = authenticatedUser?.email || 'another account';

      // Notify the token's real owner with a new link and a security notice
      try {
        await this.emailService.sendVerificationWithSecurityNotice(
          user.email,
          newVerificationToken,
          user.name,
          attemptedByEmail
        );
      } catch (error) {
        console.error('Failed to send verification email with security notice:', error);
      }

      return { error: 'wrong_user' };
    }

    // Mark email as verified and clear verification token
    user.email_verified_at = new Date();
    user.email_verification_token = null as any;
    user.email_verification_expires_at = null as any;
    await this.userRepository.save(user);

    return true;
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    
    // Show first character and last character before @ if long enough
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    
    return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
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

  /**
   * Delete a user account and all associated data permanently.
   * This is a GDPR-compliant hard delete that removes all user data from the database.
   */
  async deleteAccount(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) {
      return false;
    }

    // Delete all user data (cascade deletes should handle most of this, but we ensure complete cleanup)
    // The order matters less here due to CASCADE constraints, but we delete explicitly for clarity
    
    // Delete balances
    const balanceRepository = AppDataSource.getRepository(Balance);
    await balanceRepository.delete({ user_id: userId });

    // Delete timelogs
    const timeLogRepository = AppDataSource.getRepository(TimeLog);
    await timeLogRepository.delete({ user_id: userId });

    // Delete timers
    const timerRepository = AppDataSource.getRepository(Timer);
    await timerRepository.delete({ user_id: userId });

    // Delete target specs
    const targetSpecRepository = AppDataSource.getRepository(TargetSpec);
    await targetSpecRepository.delete({ user_id: userId });

    // Delete targets
    const targetRepository = AppDataSource.getRepository(Target);
    await targetRepository.delete({ user_id: userId });

    // Delete user settings
    const userSettingsRepository = AppDataSource.getRepository(UserSettings);
    await userSettingsRepository.delete({ user_id: userId });

    // Finally, delete the user
    await this.userRepository.delete({ id: userId });

    return true;
  }

  /**
   * Export all user data for GDPR compliance.
   * Returns a structured object containing all data associated with the user.
   */
  async exportUserData(userId: string): Promise<{
    user: Partial<User>;
    timers: Timer[];
    timelogs: TimeLog[];
    targets: Target[];
    targetSpecs: TargetSpec[];
    balances: Balance[];
    userSettings: UserSettings | null;
  } | null> {
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }

    const timerRepository = AppDataSource.getRepository(Timer);
    const timeLogRepository = AppDataSource.getRepository(TimeLog);
    const targetRepository = AppDataSource.getRepository(Target);
    const targetSpecRepository = AppDataSource.getRepository(TargetSpec);
    const balanceRepository = AppDataSource.getRepository(Balance);
    const userSettingsRepository = AppDataSource.getRepository(UserSettings);

    // Fetch all user data
    const timers = await timerRepository.find({ where: { user_id: userId } });
    const timelogs = await timeLogRepository.find({ where: { user_id: userId } });
    const targets = await targetRepository.find({ where: { user_id: userId } });
    const targetSpecs = await targetSpecRepository.find({ where: { user_id: userId } });
    const balances = await balanceRepository.find({ where: { user_id: userId } });
    const userSettings = await userSettingsRepository.findOne({ where: { user_id: userId } });

    // Return user data without sensitive fields
    const { reset_token, email_verification_token, magic_link_token, magic_link_token_expires_at, email_change_token, email_change_token_expires_at, ...safeUserData } = user;

    return {
      user: safeUserData,
      timers,
      timelogs,
      targets,
      targetSpecs,
      balances,
      userSettings,
    };
  }
}
