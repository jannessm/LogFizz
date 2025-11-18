import nodemailer from 'nodemailer';

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

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Welcome to Clock App - Please Verify Your Email',
      html: `
        <h1>Welcome to Clock App!</h1>
        <p>Hi ${userName},</p>
        <p>Thank you for signing up! We're excited to have you on board.</p>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 5px;">Verify Email Address</a></p>
        <p>Or copy and paste this link into your browser:</p>
        <p>${verificationUrl}</p>
        <p>This verification link will expire in 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
        <p>Thanks,<br/>The Clock App Team</p>
      `,
      text: `
        Welcome to Clock App!

        Hi ${userName},

        Thank you for signing up! We're excited to have you on board.

        Please verify your email address by clicking the link below:
        ${verificationUrl}

        This verification link will expire in 24 hours.

        If you didn't create an account, please ignore this email.

        Thanks,
        The Clock App Team
      `,
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

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset Request</h1>
        <p>Hi ${userName},</p>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Thanks,<br/>The Clock App Team</p>
      `,
      text: `
        Hi ${userName},

        You requested to reset your password. Use the link below to reset it:
        ${resetUrl}

        This link will expire in 1 hour.

        If you didn't request this, please ignore this email.

        Thanks,
        The Clock App Team
      `,
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
