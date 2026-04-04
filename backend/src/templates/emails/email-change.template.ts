import { generateEmailTemplate, generatePlainTextEmail, EmailTemplateData } from './base.template.js';
import { t, getLanguageFromLocale } from '../../i18n/index.js';

export interface EmailChangeVerificationData {
  userName: string;
  verificationUrl: string;
  newEmail: string;
  appUrl: string;
  locale?: string;
}

/**
 * Generates the email change verification HTML content
 */
export function generateEmailChangeVerificationContent(data: EmailChangeVerificationData): string {
  const { userName, verificationUrl, newEmail, locale = 'en-US' } = data;
  const lang = getLanguageFromLocale(locale);
  
  return `
    <h1>${t('email.emailChangeTitle', lang)}</h1>
    <p>Hi ${userName},</p>
    <p>${t('email.emailChangeIntro', lang)}</p>
    <p><strong>${newEmail}</strong></p>
    <p>${t('email.emailChangePrompt', lang)}</p>
    
    <p style="text-align: center;">
      <a href="${verificationUrl}" class="button">${t('email.emailChangeButton', lang)}</a>
    </p>
    
    <p>Or copy and paste this link into your browser:</p>
    <div class="code-block">${verificationUrl}</div>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #6b7280;">
      ⚠️ ${t('email.emailChangeExpiry', lang)}
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      🔒 ${t('email.emailChangeIgnore', lang)}
    </p>
  `;
}

/**
 * Generates complete email change verification email (HTML and plain text)
 */
export function generateEmailChangeVerificationEmail(data: EmailChangeVerificationData): { html: string; text: string; subject: string } {
  const { locale = 'en-US' } = data;
  const lang = getLanguageFromLocale(locale);
  const content = generateEmailChangeVerificationContent(data);
  
  const subject = t('email.emailChangeSubject', lang);
  
  const templateData: EmailTemplateData = {
    title: t('email.emailChangeTitle', lang),
    preheader: t('email.emailChangeIntro', lang),
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

${t('email.emailChangeIntro', lang)}

${data.newEmail}

${t('email.emailChangePrompt', lang)}
${data.verificationUrl}

${t('email.emailChangeExpiry', lang)}

${t('email.emailChangeIgnore', lang)}
      `.trim(),
    }),
  };
}
