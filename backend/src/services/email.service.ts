import nodemailer from 'nodemailer';
import { generateWelcomeEmail } from '../templates/emails/welcome.template.js';
import { generatePasswordResetEmail } from '../templates/emails/password-reset.template.js';
import { generateMagicLinkEmail } from '../templates/emails/magic-link.template.js';
import { generateEmailChangeVerificationEmail } from '../templates/emails/email-change.template.js';
import { generateStatisticsEmail } from '../templates/emails/statistics.template.js';
import { generateUserBalanceEmail } from '../templates/emails/user-balance.template.js';
import { SystemStatistics } from './statistics.service.js';
import type { TargetBalanceSummary } from './user-balance.service.js';
import { t, getLanguageFromLocale, formatDateLocale } from '../i18n/index.js';
import dotenv from 'dotenv';
import dayjs from '../../../lib/utils/dayjs.js';
  // Load environment variables
  dotenv.config();

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;
  private appUrl: string;

  constructor() {
    // In production, these should come from environment variables
    // For testing, we'll use a mock transporter
    const emailConfig = this.getEmailConfig();
    
    this.transporter = nodemailer.createTransport(emailConfig);
    const smtpUser = process.env.SMTP_USER || 'noreply@clock-app.com';
    this.fromEmail = `LogFizz <${smtpUser}>`;
    this.appUrl = process.env.APP_URL || 'http://localhost:5173';
  }

  private getEmailConfig(): EmailConfig | any {
    // Check if we're in test environment
    if (process.env.NODE_ENV === 'test') {
      // Use nodemailer's mock transporter for testing
      return {
        host: 'localhost',
        port: 1025,
        secure: false,
      };
    }

    // Production configuration from environment variables
    return {
      host: process.env.SMTP_HOST || 'smtp.example.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    };
  }

  async sendWelcomeEmail(email: string, verificationToken: string, userName: string, locale: string = 'en-US'): Promise<void> {
    const verificationUrl = `${this.appUrl}/verify-magic-link?token=${verificationToken}`;

    const emailContent = generateWelcomeEmail({
      userName,
      verificationUrl,
      appUrl: this.appUrl,
      locale,
    });

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      throw new Error('Failed to send welcome email');
    }
  }

  async sendVerificationWithSecurityNotice(
    email: string, 
    verificationToken: string, 
    userName: string, 
    attemptedByEmail: string,
    locale: string = 'en-US'
  ): Promise<void> {
    const verificationUrl = `${this.appUrl}/verify-magic-link?token=${verificationToken}`;
    const lang = getLanguageFromLocale(locale);

    const emailContent = generateWelcomeEmail({
      userName,
      verificationUrl,
      appUrl: this.appUrl,
      securityNotice: `Note: Someone logged in as "${attemptedByEmail}" attempted to use your verification link. We've generated a new verification link for your security.`,
      locale,
    });

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send verification email with security notice:', error);
      throw new Error('Failed to send verification email with security notice');
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string, userName: string, locale: string = 'en-US'): Promise<void> {
    const resetUrl = `${this.appUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const emailContent = generatePasswordResetEmail({
      userName,
      resetUrl,
      appUrl: this.appUrl,
      email: email,
      locale,
    });

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  async sendStatisticsEmail(email: string, statistics: SystemStatistics, locale: string = 'en-US'): Promise<void> {
    const reportDate = dayjs().toDate();
    const lang = getLanguageFromLocale(locale);
    const formattedDate = formatDateLocale(reportDate, locale, 'fullDate');

    const emailContent = generateStatisticsEmail({
      appUrl: this.appUrl,
      statistics,
      reportDate,
      locale,
    });

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: t('email.statisticsSubject', lang, { date: formattedDate }),
      html: emailContent.html,
      text: emailContent.text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send statistics email:', error);
      throw new Error('Failed to send statistics email');
    }
  }

  async sendUserBalanceEmail(
    email: string,
    userName: string,
    summaries: TargetBalanceSummary[],
    locale: string = 'en-US'
  ): Promise<void> {
    const reportDate = dayjs().toDate();

    const emailContent = generateUserBalanceEmail({
      userName,
      appUrl: this.appUrl,
      summaries,
      reportDate,
      locale,
    });

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send user balance email:', error);
      throw new Error('Failed to send user balance email');
    }
  }

  async sendMagicLinkEmail(email: string, magicLinkToken: string, userName: string, locale: string = 'en-US'): Promise<void> {
    const magicLinkUrl = `${this.appUrl}/verify-magic-link?token=${magicLinkToken}`;

    const emailContent = generateMagicLinkEmail({
      userName,
      magicLinkUrl,
      appUrl: this.appUrl,
      locale,
    });

    if (process.env.NODE_ENV === 'development') {
      email = process.env.ADMIN_EMAIL || email; // Override email in development to avoid sending to real users
    }

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send magic link email:', error);
      throw new Error('Failed to send magic link email');
    }
  }

  async sendEmailChangeVerification(
    newEmail: string,
    verificationToken: string,
    userName: string,
    locale: string = 'en-US'
  ): Promise<void> {
    const verificationUrl = `${this.appUrl}/verify-email-change?token=${verificationToken}`;

    const emailContent = generateEmailChangeVerificationEmail({
      userName,
      verificationUrl,
      newEmail,
      appUrl: this.appUrl,
      locale,
    });

    const mailOptions = {
      from: this.fromEmail,
      to: newEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send email change verification:', error);
      throw new Error('Failed to send email change verification');
    }
  }

  // For testing purposes - to verify email was sent
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email transporter verification failed:', error);
      return false;
    }
  }
}
