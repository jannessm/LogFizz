import { generateEmailTemplate, generatePlainTextEmail } from './base.template.js';
import { SystemStatistics } from '../../services/statistics.service.js';

export interface StatisticsEmailData {
  appUrl: string;
  statistics: SystemStatistics;
  reportDate: Date;
}

/**
 * Generates a statistics report email with system-wide metrics
 */
export function generateStatisticsEmail(data: StatisticsEmailData): {
  html: string;
  text: string;
} {
  const { appUrl, statistics, reportDate } = data;

  const content = `
    <h1>System Statistics Report</h1>
    <p>Generated on: <strong>${reportDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    })} UTC</strong></p>
    
    <div class="divider"></div>
    
    <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 15px;">👥 User Statistics</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; border: 1px solid #e5e7eb;">Total Users</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">${statistics.users.total}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">Active Users (Last 30 Days)</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #10b981;">${statistics.users.active}</td>
      </tr>
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; border: 1px solid #e5e7eb;">New Users (Last 30 Days)</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #3b82f6;">${statistics.users.new}</td>
      </tr>
    </table>
    
    <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 15px;">🎯 Button Statistics</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; border: 1px solid #e5e7eb;">Total Buttons</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">${statistics.buttons.total}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">Average per User</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">${statistics.buttons.average_per_user}</td>
      </tr>
    </table>
    
    <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 15px;">⏱️ Time Tracking Statistics</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; border: 1px solid #e5e7eb;">Total Time Logs</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">${statistics.timeLogs.total.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">Time Logs (Last 30 Days)</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">${statistics.timeLogs.last_30_days.toLocaleString()}</td>
      </tr>
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; border: 1px solid #e5e7eb;">Total Hours Tracked</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #8b5cf6;">${statistics.timeLogs.total_hours_tracked.toLocaleString()} hours</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">Hours Tracked (Last 30 Days)</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #8b5cf6;">${statistics.timeLogs.total_hours_last_30_days.toLocaleString()} hours</td>
      </tr>
    </table>
    
    <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 15px;">🏆 Top Activity</h2>
    ${statistics.activity.most_active_user ? `
    <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px;">Most Active User</h3>
      <p style="margin: 4px 0; color: #4b5563;">
        <strong>${statistics.activity.most_active_user.name}</strong> (${statistics.activity.most_active_user.email})
      </p>
      <p style="margin: 4px 0; color: #10b981; font-weight: bold;">
        ${statistics.activity.most_active_user.hours_tracked.toLocaleString()} hours tracked
      </p>
    </div>
    ` : `
    <div style="background-color: #f9fafb; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
      <p style="margin: 0; color: #6b7280;">No active users found</p>
    </div>
    `}
    
    ${statistics.activity.most_used_button ? `
    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px;">Most Used Button</h3>
      <p style="margin: 4px 0; color: #4b5563;">
        ${statistics.activity.most_used_button.emoji ? statistics.activity.most_used_button.emoji + ' ' : ''}<strong>${statistics.activity.most_used_button.name}</strong>
      </p>
      <p style="margin: 4px 0; color: #3b82f6; font-weight: bold;">
        ${statistics.activity.most_used_button.usage_count.toLocaleString()} times used
      </p>
    </div>
    ` : `
    <div style="background-color: #f9fafb; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
      <p style="margin: 0; color: #6b7280;">No button activity found</p>
    </div>
    `}
    
    <div class="divider"></div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
      This is an automated statistics report from TapShift. 
      This email was sent to the administrator email address.
    </p>
  `;

  const html = generateEmailTemplate({
    title: 'TapShift System Statistics',
    preheader: `User activity and system statistics for ${reportDate.toLocaleDateString()}`,
    content,
    appUrl,
  });

  const plainContent = `
System Statistics Report
Generated on: ${reportDate.toUTCString()}

USER STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Users: ${statistics.users.total}
Active Users (Last 30 Days): ${statistics.users.active}
New Users (Last 30 Days): ${statistics.users.new}

BUTTON STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Buttons: ${statistics.buttons.total}
Average per User: ${statistics.buttons.average_per_user}

TIME TRACKING STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Time Logs: ${statistics.timeLogs.total.toLocaleString()}
Time Logs (Last 30 Days): ${statistics.timeLogs.last_30_days.toLocaleString()}
Total Hours Tracked: ${statistics.timeLogs.total_hours_tracked.toLocaleString()} hours
Hours Tracked (Last 30 Days): ${statistics.timeLogs.total_hours_last_30_days.toLocaleString()} hours

TOP ACTIVITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${statistics.activity.most_active_user 
  ? `Most Active User: ${statistics.activity.most_active_user.name} (${statistics.activity.most_active_user.email})
Hours Tracked: ${statistics.activity.most_active_user.hours_tracked.toLocaleString()} hours`
  : 'No active users found'}

${statistics.activity.most_used_button 
  ? `Most Used Button: ${statistics.activity.most_used_button.emoji || ''} ${statistics.activity.most_used_button.name}
Times Used: ${statistics.activity.most_used_button.usage_count.toLocaleString()}`
  : 'No button activity found'}

────────────────────────────────────────
This is an automated statistics report from TapShift.
  `;

  const text = generatePlainTextEmail({
    title: 'TapShift System Statistics',
    content: plainContent,
    appUrl,
  });

  return { html, text };
}
