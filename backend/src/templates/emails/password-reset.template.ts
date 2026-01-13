import { generateEmailTemplate, generatePlainTextEmail, EmailTemplateData } from './base.template.js';

export interface PasswordResetEmailData {
  userName: string;
  resetUrl: string;
  appUrl: string;
  email: string;
}

/**
 * Generates the password reset email HTML content
 */
export function generatePasswordResetEmailContent(data: PasswordResetEmailData): string {
  const { userName, resetUrl } = data;
  
  return `
    <h1>Password Reset Request</h1>
    <p>Hi ${userName},</p>
    <p>We received a request to reset the password for your TapShift account.</p>
    <p>If you made this request, click the button below to reset your password:</p>
    
    <p style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Your Password</a>
    </p>
    
    <p>Or copy and paste this link into your browser:</p>
    <div class="code-block">${resetUrl}</div>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #6b7280;">
      ⚠️ This password reset link will expire in <strong>1 hour</strong>.
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      🔒 If you didn't request a password reset, please ignore this email. Your password will remain unchanged, and your account is secure.
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      For security reasons, we recommend that you don't share this email with anyone.
    </p>
  `;
}

/**
 * Generates complete password reset email (HTML and plain text)
 */
export function generatePasswordResetEmail(data: PasswordResetEmailData): { html: string; text: string } {
  const content = generatePasswordResetEmailContent(data);
  
  const templateData: EmailTemplateData = {
    title: 'Reset Your Password',
    preheader: 'You requested to reset your password',
    content,
    appUrl: data.appUrl,
  };
  
  return {
    html: generateEmailTemplate(templateData),
    text: generatePlainTextEmail({
      ...templateData,
      content: `
Hi ${data.userName},

We received a request to reset the password for your Clock App account.

If you made this request, use the link below to reset your password:
${data.resetUrl}

This password reset link will expire in 1 hour.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged, and your account is secure.

For security reasons, we recommend that you don't share this email with anyone.
      `.trim(),
    }),
  };
}
