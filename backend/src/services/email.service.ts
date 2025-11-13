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

  async sendLoginCode(email: string, code: string, userName: string): Promise<void> {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Your Login Code',
      html: `
        <h1>Your Login Code</h1>
        <p>Hi ${userName},</p>
        <p>Your login code is:</p>
        <h2 style="font-size: 32px; letter-spacing: 8px; font-family: monospace;">${code}</h2>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Thanks,<br/>The Clock App Team</p>
      `,
      text: `
        Hi ${userName},

        Your login code is: ${code}

        This code will expire in 15 minutes.

        If you didn't request this, please ignore this email.

        Thanks,
        The Clock App Team
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send login code email:', error);
      throw new Error('Failed to send login code email');
    }
  }

  async sendHolidayUpdateNotification(adminEmail: string, summary: {
    updatedStates: Array<{ state: string; count: number }>;
    totalHolidays: number;
    years: number[];
  }): Promise<void> {
    const statesList = summary.updatedStates
      .map(s => `<li>${s.state}: ${s.count} holidays</li>`)
      .join('\n');

    const mailOptions = {
      from: this.fromEmail,
      to: adminEmail,
      subject: 'Holiday Data Update Summary',
      html: `
        <h1>Holiday Data Update Summary</h1>
        <p>The holiday data has been automatically updated.</p>
        <h3>Summary:</h3>
        <ul>
          <li>Total holidays updated: ${summary.totalHolidays}</li>
          <li>Years: ${summary.years.join(', ')}</li>
        </ul>
        <h3>Updated States:</h3>
        <ul>
          ${statesList}
        </ul>
        <p>Thanks,<br/>The Clock App Team</p>
      `,
      text: `
        Holiday Data Update Summary

        The holiday data has been automatically updated.

        Summary:
        - Total holidays updated: ${summary.totalHolidays}
        - Years: ${summary.years.join(', ')}

        Updated States:
        ${summary.updatedStates.map(s => `- ${s.state}: ${s.count} holidays`).join('\n')}

        Thanks,
        The Clock App Team
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send holiday update notification:', error);
      throw new Error('Failed to send holiday update notification');
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
