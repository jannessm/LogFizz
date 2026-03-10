import { generateEmailTemplate, generatePlainTextEmail } from './base.template.js';
import { t, getLanguageFromLocale, formatDateLocale } from '../../i18n/index.js';
import type { TargetBalanceSummary } from '../../services/user-balance.service.js';

export interface UserBalanceEmailData {
  userName: string;
  appUrl: string;
  summaries: TargetBalanceSummary[];
  reportDate: Date;
  locale?: string;
}

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format minutes into hours and minutes string
 */
function formatMinutes(minutes: number, lang: string): string {
  const sign = minutes < 0 ? '-' : (minutes > 0 ? '+' : '');
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}${t('email.balanceHourShort', lang)}${m > 0 ? ` ${m}${t('email.balanceMinuteShort', lang)}` : ''}`;
}

/**
 * Generates a user balance statistics email
 */
export function generateUserBalanceEmail(data: UserBalanceEmailData): {
  html: string;
  text: string;
  subject: string;
} {
  const { userName, appUrl, summaries, reportDate, locale = 'en-US' } = data;
  const lang = getLanguageFromLocale(locale);
  const formattedDate = formatDateLocale(reportDate, locale, 'fullDate');

  const summaryRows = summaries.map(s => {
    const balanceColor = s.cumulativeMinutes >= 0 ? '#10b981' : '#ef4444';
    const monthBalanceColor = s.currentMonthBalance >= 0 ? '#10b981' : '#ef4444';

    return `
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 18px;">${escapeHtml(s.targetName)}</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${t('email.balanceDueHours', lang)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${formatMinutes(s.currentMonthDueMinutes, lang)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${t('email.balanceWorkedHours', lang)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${formatMinutes(s.currentMonthWorkedMinutes, lang)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${t('email.balanceMonthBalance', lang)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; text-align: right; color: ${monthBalanceColor};">${formatMinutes(s.currentMonthBalance, lang)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${t('email.balanceCumulative', lang)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; text-align: right; color: ${balanceColor};">${formatMinutes(s.cumulativeMinutes, lang)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; color: #6b7280;">${t('email.balanceWorkedDays', lang)} / ${t('email.balanceSickDays', lang)} / ${t('email.balanceHolidays', lang)}</td>
          <td style="padding: 8px 12px; font-weight: bold; text-align: right;">${s.workedDays} / ${s.sickDays} / ${s.holidays}</td>
        </tr>
      </table>
    </div>`;
  }).join('');

  const noData = summaries.length === 0
    ? `<p style="color: #6b7280;">${t('email.balanceNoTargets', lang)}</p>`
    : '';

  const content = `
    <h1>${t('email.balanceTitle', lang)}</h1>
    <p>${t('email.balanceGreeting', lang, { name: escapeHtml(userName) })}</p>
    <p>${t('email.balanceIntro', lang, { date: formattedDate })}</p>
    
    <div class="divider"></div>
    
    ${summaryRows}
    ${noData}
    
    <div class="divider"></div>
    
    <div style="text-align: center; margin-top: 24px;">
      <a href="${appUrl}" class="button">${t('email.balanceOpenApp', lang)}</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
      ${t('email.balanceFooter', lang)}
    </p>
  `;

  const html = generateEmailTemplate({
    title: t('email.balanceTitle', lang),
    preheader: t('email.balancePreheader', lang),
    content,
    appUrl,
  });

  // Plain text version
  const plainSummaries = summaries.map(s => {
    return `
${escapeHtml(s.targetName)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${t('email.balanceDueHours', lang)}: ${formatMinutes(s.currentMonthDueMinutes, lang)}
${t('email.balanceWorkedHours', lang)}: ${formatMinutes(s.currentMonthWorkedMinutes, lang)}
${t('email.balanceMonthBalance', lang)}: ${formatMinutes(s.currentMonthBalance, lang)}
${t('email.balanceCumulative', lang)}: ${formatMinutes(s.cumulativeMinutes, lang)}
${t('email.balanceWorkedDays', lang)}: ${s.workedDays} | ${t('email.balanceSickDays', lang)}: ${s.sickDays} | ${t('email.balanceHolidays', lang)}: ${s.holidays}`;
  }).join('\n');

  const plainContent = `
${t('email.balanceTitle', lang)}

${t('email.balanceGreeting', lang, { name: userName })}
${t('email.balanceIntro', lang, { date: formattedDate })}

${plainSummaries || t('email.balanceNoTargets', lang)}

────────────────────────────────────────
${t('email.balanceFooter', lang)}
  `;

  const text = generatePlainTextEmail({
    title: t('email.balanceTitle', lang),
    content: plainContent,
    appUrl,
  });

  const subject = t('email.balanceSubject', lang, { date: formattedDate });

  return { html, text, subject };
}
