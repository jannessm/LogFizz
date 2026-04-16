/**
 * Base email template layout
 * Provides a consistent look and feel for all emails sent from the Clock app
 */

export interface EmailTemplateData {
  title: string;
  preheader?: string;
  content: string;
  appUrl: string;
}

/**
 * Generates the base HTML template for emails
 * @param data Email template data
 * @returns Complete HTML email
 */
export function generateEmailTemplate(data: EmailTemplateData): string {
  const { title, preheader, content, appUrl } = data;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      color: #333333;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header-title {
      color: #ffffff;
      font-size: 28px;
      font-weight: bold;
      margin: 0;
      letter-spacing: 1px;
    }
    .header-icon {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .content {
      padding: 40px 30px;
      line-height: 1.6;
    }
    .content h1 {
      color: #1f2937;
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .content p {
      color: #4b5563;
      font-size: 16px;
      margin: 16px 0;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      margin: 24px 0;
      background-color: #3B82F6;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      transition: background-color 0.3s;
    }
    .button:hover {
      background-color: #2563EB;
    }
    .code-block {
      background-color: #f3f4f6;
      padding: 12px 16px;
      border-radius: 4px;
      border-left: 4px solid #3B82F6;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #1f2937;
      margin: 16px 0;
      word-break: break-all;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      color: #6b7280;
      font-size: 14px;
      margin: 8px 0;
    }
    .footer a {
      color: #3B82F6;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    .divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 30px 0;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 30px 20px;
      }
      .header {
        padding: 30px 20px;
      }
    }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <div class="email-container">
          <!-- Header -->
          <div class="header">
            <div class="header-icon">⏳</div>
            <h1 class="header-title">LogFizz</h1>
          </div>
          
          <!-- Content -->
          <div class="content">
            ${content}
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p>Thank you for using LogFizz!</p>
            <p>
              <a href="${appUrl}">Visit LogFizz</a> |
              <a href="${appUrl}/help">Help Center</a> |
              <a href="${appUrl}/privacy">Privacy Policy</a>
            </p>
            <p style="margin-top: 20px;">
              © ${new Date().getFullYear()} LogFizz. All rights reserved.
            </p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates plain text version of email
 * 
 * NOTE: This function is designed ONLY for converting our own HTML email templates
 * to plain text. It is NOT a general-purpose HTML sanitizer and should NOT be used
 * with untrusted or user-provided content.
 * 
 * Security: The input 'content' comes from our own email templates (welcome.template.ts,
 * password-reset.template.ts), not from user input. These templates are trusted code.
 * 
 * @param data Email template data from trusted templates
 * @returns Plain text email
 */
export function generatePlainTextEmail(data: EmailTemplateData): string {
  const { title, content, appUrl } = data;
  
  // Strip HTML tags from content (safe - content is from our trusted templates)
  // We don't decode HTML entities because our templates use plain text, not entities
  const plainContent = content
    .replace(/<h1[^>]*>/gi, '\n\n')
    .replace(/<\/h1>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>/gi, '')
    .replace(/<\/a>/gi, '')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  return `
════════════════════════════════════════
⏳ LogFizz
════════════════════════════════════════

${title}

${plainContent}

────────────────────────────────────────
Thank you for using LogFizz!

Visit LogFizz: ${appUrl}
Help Center: ${appUrl}/help
Privacy Policy: ${appUrl}/privacy

© ${new Date().getFullYear()} LogFizz. All rights reserved.
  `.trim();
}
