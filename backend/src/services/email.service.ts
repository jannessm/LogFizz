import nodemailer from 'nodemailer';
import { generateWelcomeEmail } from '../templates/emails/welcome.template.js';
import { generatePasswordResetEmail } from '../templates/emails/password-reset.template.js';
import { generateStatisticsEmail } from '../templates/emails/statistics.template.js';
import { SystemStatistics } from './statistics.service.js';
import { t, getLanguageFromLocale, formatDateLocale } from '../i18n/index.js';
import dotenv from 'dotenv';
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
    this.fromEmail = process.env.SMTP_USER || 'noreply@clock-app.com';
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
    const verificationUrl = `${this.appUrl}/verify-email?token=${verificationToken}`;

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
    const verificationUrl = `${this.appUrl}/verify-email?token=${verificationToken}`;
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
    const reportDate = new Date();
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
