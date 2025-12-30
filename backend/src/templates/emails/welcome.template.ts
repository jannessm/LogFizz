import { generateEmailTemplate, generatePlainTextEmail, EmailTemplateData } from './base.template.js';

export interface WelcomeEmailData {
  userName: string;
  verificationUrl: string;
  appUrl: string;
  securityNotice?: string;
}

/**
 * Generates the welcome email HTML content
 */
export function generateWelcomeEmailContent(data: WelcomeEmailData): string {
  const { userName, verificationUrl, securityNotice } = data;
  
  return `
    <h1>Welcome to TapShift!</h1>
    <p>Hi ${userName},</p>
    <p>Thank you for signing up! We're excited to have you on board.</p>
    <p>TapShift helps you track your time efficiently with customizable buttons, automatic logging, and insightful statistics.</p>
    
    ${securityNotice ? `
    <div class="divider"></div>
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0;">
      <p style="margin: 0; color: #92400e;">
        <strong>🔒 Security Notice:</strong><br>
        ${securityNotice}
      </p>
    </div>
    ` : ''}
    
    <div class="divider"></div>
    
    <p><strong>Please verify your email address to get started:</strong></p>
    <p style="text-align: center;">
      <a href="${verificationUrl}" class="button">Verify Email Address</a>
    </p>
    
    <p>Or copy and paste this link into your browser:</p>
    <div class="code-block">${verificationUrl}</div>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #6b7280;">
      ⚠️ This verification link will expire in <strong>24 hours</strong>.
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      If you didn't create an account, please ignore this email and no account will be created.
    </p>
  `;
}

/**
 * Generates complete welcome email (HTML and plain text)
 */
export function generateWelcomeEmail(data: WelcomeEmailData): { html: string; text: string } {
  const content = generateWelcomeEmailContent(data);
  
  const templateData: EmailTemplateData = {
    title: 'Welcome to Clock App',
    preheader: 'Please verify your email address to get started',
    content,
    appUrl: data.appUrl,
  };
  
  const securityNoticeText = data.securityNotice ? `\n\n🔒 SECURITY NOTICE:\n${data.securityNotice}\n` : '';
  
  return {
    html: generateEmailTemplate(templateData),
    text: generatePlainTextEmail({
      ...templateData,
      content: `
Hi ${data.userName},

Thank you for signing up! We're excited to have you on board.

Clock App helps you track your time efficiently with customizable buttons, automatic logging, and insightful statistics.
${securityNoticeText}
Please verify your email address by clicking the link below:
${data.verificationUrl}

This verification link will expire in 24 hours.

If you didn't create an account, please ignore this email and no account will be created.
      `.trim(),
    }),
  };
}
