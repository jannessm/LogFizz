import { generateEmailTemplate, generatePlainTextEmail, EmailTemplateData } from './base.template.js';
import { t, getLanguageFromLocale } from '../../i18n/index.js';

export interface MagicLinkEmailData {
  userName: string;
  magicLinkUrl: string;
  appUrl: string;
  locale?: string;
}

/**
 * Generates the magic link email HTML content
 */
export function generateMagicLinkEmailContent(data: MagicLinkEmailData): string {
  const { userName, magicLinkUrl, locale = 'en-US' } = data;
  const lang = getLanguageFromLocale(locale);
  
  return `
    <h1>${t('email.magicLinkTitle', lang)}</h1>
    <p>Hi ${userName},</p>
    <p>${t('email.magicLinkIntro', lang)}</p>
    <p>${t('email.magicLinkPrompt', lang)}</p>
    
    <p style="text-align: center;">
      <a href="${magicLinkUrl}" class="button">${t('email.magicLinkButton', lang)}</a>
    </p>
    
    <p>Or copy and paste this link into your browser:</p>
    <div class="code-block"><a href="${magicLinkUrl}" x-apple-data-detectors="false" style="color: inherit; text-decoration: none; pointer-events: none; cursor: text;">${magicLinkUrl}</a></div>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #6b7280;">
      ⚠️ ${t('email.magicLinkExpiry', lang)}
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      🔒 ${t('email.magicLinkIgnore', lang)}
    </p>
  `;
}

/**
 * Generates complete magic link email (HTML and plain text)
 */
export function generateMagicLinkEmail(data: MagicLinkEmailData): { html: string; text: string; subject: string } {
  const { locale = 'en-US' } = data;
  const lang = getLanguageFromLocale(locale);
  const content = generateMagicLinkEmailContent(data);
  
  const subject = t('email.magicLinkSubject', lang);
  
  const templateData: EmailTemplateData = {
    title: t('email.magicLinkTitle', lang),
    preheader: t('email.magicLinkIntro', lang),
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

${t('email.magicLinkIntro', lang)}

${t('email.magicLinkPrompt', lang)}
${data.magicLinkUrl}

${t('email.magicLinkExpiry', lang)}

${t('email.magicLinkIgnore', lang)}
      `.trim(),
    }),
  };
}
