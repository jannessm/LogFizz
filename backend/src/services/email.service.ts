import nodemailer from 'nodemailer';
import { generateWelcomeEmail } from '../templates/emails/welcome.template.js';
import { generatePasswordResetEmail } from '../templates/emails/password-reset.template.js';

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
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@clock-app.com';
    this.appUrl = process.env.APP_URL || 'http://localhost:3000';
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

  async sendWelcomeEmail(email: string, verificationToken: string, userName: string): Promise<void> {
    const verificationUrl = `${this.appUrl}/verify-email?token=${verificationToken}`;

    const emailContent = generateWelcomeEmail({
      userName,
      verificationUrl,
      appUrl: this.appUrl,
    });

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Welcome to Clock App - Please Verify Your Email',
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

  async sendPasswordResetEmail(email: string, resetToken: string, userName: string): Promise<void> {
    const resetUrl = `${this.appUrl}/reset-password?token=${resetToken}`;

    const emailContent = generatePasswordResetEmail({
      userName,
      resetUrl,
      appUrl: this.appUrl,
    });

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Password Reset Request',
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
