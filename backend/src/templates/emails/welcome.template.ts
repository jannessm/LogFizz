import { generateEmailTemplate, generatePlainTextEmail, EmailTemplateData } from './base.template.js';
import { t, getLanguageFromLocale } from '../../i18n/index.js';

export interface WelcomeEmailData {
  userName: string;
  verificationUrl: string;
  appUrl: string;
  securityNotice?: string;
  locale?: string;
}

/**
 * Generates the welcome email HTML content
 */
export function generateWelcomeEmailContent(data: WelcomeEmailData): string {
  const { userName, verificationUrl, securityNotice, locale = 'en-US' } = data;
  const lang = getLanguageFromLocale(locale);
  
  return `
    <h1>${t('email.welcomeTitle', lang)}</h1>
    <p>Hi ${userName},</p>
    <p>${t('email.welcomeThankYou', lang)}</p>
    <p>LogFizz helps you track your time efficiently with customizable buttons, automatic logging, and insightful statistics.</p>
    
    ${securityNotice ? `
    <div class="divider"></div>
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0;">
      <p style="margin: 0; color: #92400e;">
        <strong>🔒 ${t('email.welcomeSecurityNotice', lang)}:</strong><br>
        ${securityNotice}
      </p>
    </div>
    ` : ''}
    
    <div class="divider"></div>
    
    <p><strong>${t('email.welcomeVerifyPrompt', lang)}</strong></p>
    <p style="text-align: center;">
      <a href="${verificationUrl}" class="button">${t('email.welcomeVerifyButton', lang)}</a>
    </p>
    
    <p>Or copy and paste this link into your browser:</p>
    <div class="code-block"><a href="${verificationUrl}" x-apple-data-detectors="false" style="color: inherit; text-decoration: none; pointer-events: none; cursor: text;">${verificationUrl}</a></div>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #6b7280;">
      ⚠️ ${t('email.welcomeExpiryNote', lang)}
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      ${t('email.welcomeIgnoreNote', lang)}
    </p>
  `;
}

/**
 * Generates complete welcome email (HTML and plain text)
 */
export function generateWelcomeEmail(data: WelcomeEmailData): { html: string; text: string; subject: string } {
  const { locale = 'en-US' } = data;
  const lang = getLanguageFromLocale(locale);
  const content = generateWelcomeEmailContent(data);
  
  const subject = data.securityNotice 
    ? t('email.welcomeSubjectResend', lang)
    : t('email.welcomeSubject', lang);
  
  const templateData: EmailTemplateData = {
    title: t('email.welcomeTitle', lang),
    preheader: t('email.welcomeVerifyPrompt', lang),
    content,
    appUrl: data.appUrl,
  };
  
  const securityNoticeText = data.securityNotice ? `\n\n🔒 ${t('email.welcomeSecurityNotice', lang).toUpperCase()}:\n${data.securityNotice}\n` : '';
  
  return {
    subject,
    html: generateEmailTemplate(templateData),
    text: generatePlainTextEmail({
      ...templateData,
      content: `
Hi ${data.userName},

${t('email.welcomeThankYou', lang)}

LogFizz helps you track your time efficiently with customizable buttons, automatic logging, and insightful statistics.
${securityNoticeText}
${t('email.welcomeVerifyPrompt', lang)}
${data.verificationUrl}

${t('email.welcomeExpiryNote', lang)}

${t('email.welcomeIgnoreNote', lang)}
      `.trim(),
    }),
  };
}
