import { generateEmailTemplate, generatePlainTextEmail } from './base.template.js';
import { SystemStatistics } from '../../services/statistics.service.js';
import { t, getLanguageFromLocale, formatDateLocale } from '../../i18n/index.js';

export interface StatisticsEmailData {
  appUrl: string;
  statistics: SystemStatistics;
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
 * Generates a statistics report email with system-wide metrics
 */
export function generateStatisticsEmail(data: StatisticsEmailData): {
  html: string;
  text: string;
} {
  const { appUrl, statistics, reportDate, locale = 'en-US' } = data;
  const lang = getLanguageFromLocale(locale);
  const formattedDate = formatDateLocale(reportDate, locale, 'dateTime');

  const content = `
    <h1>${t('email.statisticsTitle', lang)}</h1>
    <p>Generated on: <strong>${formattedDate} UTC</strong></p>
    
    <div class="divider"></div>
    
    <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 15px;">👥 ${t('email.statisticsUserStats', lang)}</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; border: 1px solid #e5e7eb;">${t('email.statisticsTotalUsers', lang)}</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">${statistics.users.total}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">Active Users (Last 30 Days)</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #10b981;">${statistics.users.active}</td>
      </tr>
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; border: 1px solid #e5e7eb;">${t('email.statisticsNewUsersMonth', lang)}</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #3b82f6;">${statistics.users.new}</td>
      </tr>
    </table>
    
    <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 15px;">🎯 ${t('email.statisticsTimerStats', lang)}</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; border: 1px solid #e5e7eb;">${t('email.statisticsTotalTimers', lang)}</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">${statistics.timers.total}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">${t('email.statisticsAvgLogsPerUser', lang)}</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">${statistics.timers.average_per_user}</td>
      </tr>
    </table>
    
    <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 15px;">⏱️ ${t('email.statisticsTimeStats', lang)}</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; border: 1px solid #e5e7eb;">${t('email.statisticsTotalLogs', lang)}</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">${statistics.timeLogs.total.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">Time Logs (Last 30 Days)</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">${statistics.timeLogs.last_30_days.toLocaleString()}</td>
      </tr>
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; border: 1px solid #e5e7eb;">${t('email.statisticsTotalHours', lang)}</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #8b5cf6;">${statistics.timeLogs.total_hours_tracked.toLocaleString()} ${t('email.statisticsHours', lang)}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">Hours Tracked (Last 30 Days)</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #8b5cf6;">${statistics.timeLogs.total_hours_last_30_days.toLocaleString()} ${t('email.statisticsHours', lang)}</td>
      </tr>
    </table>
    
    <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 15px;">🏆 ${t('email.statisticsTopActivity', lang)}</h2>
    ${statistics.activity.most_active_user ? `
    <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px;">${t('email.statisticsMostActiveUser', lang)}</h3>
      <p style="margin: 4px 0; color: #4b5563;">
        <strong>${escapeHtml(statistics.activity.most_active_user.name)}</strong> (${escapeHtml(statistics.activity.most_active_user.email)})
      </p>
      <p style="margin: 4px 0; color: #10b981; font-weight: bold;">
        ${statistics.activity.most_active_user.hours_tracked.toLocaleString()} ${t('email.statisticsHours', lang)} tracked
      </p>
    </div>
    ` : `
    <div style="background-color: #f9fafb; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
      <p style="margin: 0; color: #6b7280;">${t('email.statisticsNoData', lang)}</p>
    </div>
    `}
    
    ${statistics.activity.most_used_timer ? `
    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px;">${t('email.statisticsMostUsedTimer', lang)}</h3>
      <p style="margin: 4px 0; color: #4b5563;">
        ${statistics.activity.most_used_timer.emoji ? escapeHtml(statistics.activity.most_used_timer.emoji) + ' ' : ''}<strong>${escapeHtml(statistics.activity.most_used_timer.name)}</strong>
      </p>
      <p style="margin: 4px 0; color: #3b82f6; font-weight: bold;">
        ${statistics.activity.most_used_timer.usage_count.toLocaleString()} times used
      </p>
    </div>
    ` : `
    <div style="background-color: #f9fafb; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
      <p style="margin: 0; color: #6b7280;">${t('email.statisticsNoData', lang)}</p>
    </div>
    `}
    
    <div class="divider"></div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
      This is an automated statistics report from LogFizz. 
      This email was sent to the administrator email address.
    </p>
  `;

  const html = generateEmailTemplate({
    title: t('email.statisticsTitle', lang),
    preheader: `User activity and system statistics for ${formattedDate}`,
    content,
    appUrl,
  });

  const plainContent = `
${t('email.statisticsTitle', lang)}
Generated on: ${formattedDate} UTC

${t('email.statisticsUserStats', lang).toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${t('email.statisticsTotalUsers', lang)}: ${statistics.users.total}
Active Users (Last 30 Days): ${statistics.users.active}
${t('email.statisticsNewUsersMonth', lang)}: ${statistics.users.new}

${t('email.statisticsTimerStats', lang).toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${t('email.statisticsTotalTimers', lang)}: ${statistics.timers.total}
${t('email.statisticsAvgLogsPerUser', lang)}: ${statistics.timers.average_per_user}

${t('email.statisticsTimeStats', lang).toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${t('email.statisticsTotalLogs', lang)}: ${statistics.timeLogs.total.toLocaleString()}
Time Logs (Last 30 Days): ${statistics.timeLogs.last_30_days.toLocaleString()}
${t('email.statisticsTotalHours', lang)}: ${statistics.timeLogs.total_hours_tracked.toLocaleString()} ${t('email.statisticsHours', lang)}
Hours Tracked (Last 30 Days): ${statistics.timeLogs.total_hours_last_30_days.toLocaleString()} ${t('email.statisticsHours', lang)}

${t('email.statisticsTopActivity', lang).toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${statistics.activity.most_active_user 
  ? `${t('email.statisticsMostActiveUser', lang)}: ${statistics.activity.most_active_user.name} (${statistics.activity.most_active_user.email})
${t('email.statisticsTotalHours', lang)}: ${statistics.activity.most_active_user.hours_tracked.toLocaleString()} ${t('email.statisticsHours', lang)}`
  : t('email.statisticsNoData', lang)}

${statistics.activity.most_used_timer 
  ? `${t('email.statisticsMostUsedTimer', lang)}: ${statistics.activity.most_used_timer.emoji || ''} ${statistics.activity.most_used_timer.name}
Times Used: ${statistics.activity.most_used_timer.usage_count.toLocaleString()}`
  : t('email.statisticsNoData', lang)}

────────────────────────────────────────
This is an automated statistics report from LogFizz.
  `;

  const text = generatePlainTextEmail({
    title: t('email.statisticsTitle', lang),
    content: plainContent,
    appUrl,
  });

  return { html, text };
}
