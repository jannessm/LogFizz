import { generateEmailTemplate, generatePlainTextEmail, EmailTemplateData } from './base.template.js';
import { t, getLanguageFromLocale } from '../../i18n/index.js';

export interface PasswordResetEmailData {
  userName: string;
  resetUrl: string;
  appUrl: string;
  email: string;
  locale?: string;
}

/**
 * Generates the password reset email HTML content
 */
export function generatePasswordResetEmailContent(data: PasswordResetEmailData): string {
  const { userName, resetUrl, locale = 'en-US' } = data;
  const lang = getLanguageFromLocale(locale);
  
  return `
    <h1>${t('email.passwordResetTitle', lang)}</h1>
    <p>Hi ${userName},</p>
    <p>${t('email.passwordResetIntro', lang)}</p>
    <p>${t('email.passwordResetPrompt', lang)}</p>
    
    <p style="text-align: center;">
      <a href="${resetUrl}" class="button">${t('email.passwordResetButton', lang)}</a>
    </p>
    
    <p>Or copy and paste this link into your browser:</p>
    <div class="code-block"><a href="${resetUrl}" x-apple-data-detectors="false" style="color: inherit; text-decoration: none; pointer-events: none; cursor: text;">${resetUrl}</a></div>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #6b7280;">
      ⚠️ ${t('email.passwordResetExpiry', lang)}
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      🔒 ${t('email.passwordResetIgnore', lang)}
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      For security reasons, we recommend that you don't share this email with anyone.
    </p>
  `;
}

/**
 * Generates complete password reset email (HTML and plain text)
 */
export function generatePasswordResetEmail(data: PasswordResetEmailData): { html: string; text: string; subject: string } {
  const { locale = 'en-US' } = data;
  const lang = getLanguageFromLocale(locale);
  const content = generatePasswordResetEmailContent(data);
  
  const subject = t('email.passwordResetSubject', lang);
  
  const templateData: EmailTemplateData = {
    title: t('email.passwordResetTitle', lang),
    preheader: t('email.passwordResetIntro', lang),
    content,
    appUrl: data.appUrl,
  };
  
  return {
    subject,
    html: generateEmailTemplate(templateData),
    text: generatePlainTextEmail({
      ...templateData,
      content: `
Hi ${data.userName},

${t('email.passwordResetIntro', lang)}

${t('email.passwordResetPrompt', lang)}
${data.resetUrl}

${t('email.passwordResetExpiry', lang)}

${t('email.passwordResetIgnore', lang)}

For security reasons, we recommend that you don't share this email with anyone.
      `.trim(),
    }),
  };
}
