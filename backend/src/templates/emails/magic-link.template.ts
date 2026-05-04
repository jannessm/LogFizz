import { generateEmailTemplate, generatePlainTextEmail, EmailTemplateData } from './base.template.js';
import { t, getLanguageFromLocale } from '../../i18n/index.js';

export interface MagicLinkEmailData {
  userName: string;
  magicLinkUrl: string;
  otpCode: string;
  appUrl: string;
  locale?: string;
}

/**
 * Generates the magic link email HTML content
 */
export function generateMagicLinkEmailContent(data: MagicLinkEmailData): string {
  const { userName, magicLinkUrl, otpCode, locale = 'en-US' } = data;
  const lang = getLanguageFromLocale(locale);
  
  return `
    <h1>${t('email.magicLinkTitle', lang)}</h1>
    <p>Hi ${userName},</p>
    <p>${t('email.magicLinkIntro', lang)}</p>
    <p>${t('email.magicLinkPrompt', lang)}</p>
    
    <div style="text-align: center; margin: 24px 0;">
      <div style="display: inline-block; background: #f3f4f6; border: 2px dashed #9ca3af; border-radius: 12px; padding: 16px 32px;">
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.1em;">${t('email.magicLinkCode', lang)}</p>
        <p style="margin: 0; font-size: 36px; font-weight: 700; letter-spacing: 0.25em; color: #111827; font-family: monospace;">${otpCode}</p>
      </div>
    </div>

    <p style="text-align: center; font-size: 13px; color: #6b7280;">${t('email.magicLinkOrClick', lang)}</p>
    <p style="text-align: center;">
      <a href="${magicLinkUrl}" class="button">${t('email.magicLinkButton', lang)}</a>
    </p>
    
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

${t('email.magicLinkCode', lang)}: ${data.otpCode}

${t('email.magicLinkOrClick', lang)}
${data.magicLinkUrl}

${t('email.magicLinkExpiry', lang)}

${t('email.magicLinkIgnore', lang)}
      `.trim(),
    }),
  };
}
