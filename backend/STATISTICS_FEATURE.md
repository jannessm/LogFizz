# Statistics Feature

The Clock app includes a built-in statistics reporting system that generates comprehensive system-wide metrics and can send them via email to administrators.

## Overview

The statistics feature provides insights into:
- **User Activity**: Total users, active users in the last 30 days, new user registrations
- **Button Usage**: Total buttons created, average buttons per user
- **Time Tracking**: Total time logs, hours tracked overall and in the last 30 days
- **Top Activity**: Most active user and most frequently used button

## Components

### 1. Statistics Service (`src/services/statistics.service.ts`)

The `StatisticsService` class provides methods to:
- Generate comprehensive system-wide statistics
- Calculate total hours tracked from time log pairs
- Identify the most active user by hours tracked
- Find the most frequently used button

**Example Usage:**
```typescript
import { StatisticsService } from './services/statistics.service.js';

const statsService = new StatisticsService();
const statistics = await statsService.generateSystemStatistics();
console.log(statistics);
```

### 2. Email Template (`src/templates/emails/statistics.template.ts`)

Professional email template with:
- HTML version with formatted tables and styling
- Plain text version for email clients that don't support HTML
- Consistent branding using the base email template

### 3. CLI Script (`src/scripts/statistics.ts`)

Command-line tool for generating and sending statistics reports.

## Usage

### Display Statistics in Console

```bash
npm run statistics:show
```

This will generate and display statistics in the console without sending any emails.

### Send Statistics Email

```bash
# Send to admin email (set in ADMIN_EMAIL environment variable)
npm run statistics:send

# Send to a specific email address
npm run statistics:send -- --email custom@example.com
```

## Configuration

Add the following to your `.env` file:

```env
# Email Configuration (required for sending emails)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password

# Admin Email (required for npm run statistics:send)
ADMIN_EMAIL=admin@example.com

# Application URL (used in email templates)
APP_URL=https://your-app.com
```

## Example Output

### Console Output

```
═══════════════════════════════════════
  TAPSHIFT SYSTEM STATISTICS REPORT
═══════════════════════════════════════

👥 USER STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Users: 2
Active Users (Last 30 Days): 1
New Users (Last 30 Days): 2

🎯 BUTTON STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Buttons: 5
Average per User: 2.5

⏱️  TIME TRACKING STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Time Logs: 29
Time Logs (Last 30 Days): 29
Total Hours Tracked: 62 hours
Hours Tracked (Last 30 Days): 62 hours

🏆 TOP ACTIVITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Most Active User: Demo User
  Email: demo@example.com
  Hours Tracked: 62 hours

Most Used Button: 💼 Work
  Times Used: 6
```

### Email Output

The email version includes:
- Professional HTML formatting with tables
- Color-coded sections for easy reading
- Responsive design for mobile devices
- Plain text alternative for compatibility

## Automation

You can automate statistics reports using cron jobs or task schedulers:

### Cron Example (Daily Report at 9 AM)

```bash
# Add to crontab
0 9 * * * cd /path/to/backend && npm run statistics:send
```

### Cron Example (Weekly Report on Monday at 9 AM)

```bash
# Add to crontab
0 9 * * 1 cd /path/to/backend && npm run statistics:send
```

## API Integration

While the statistics feature is primarily designed as a CLI tool, you can integrate it into your application:

```typescript
import { StatisticsService } from './services/statistics.service.js';
import { EmailService } from './services/email.service.js';

// In your API endpoint or scheduled task
const statsService = new StatisticsService();
const emailService = new EmailService();

const statistics = await statsService.generateSystemStatistics();
await emailService.sendStatisticsEmail('admin@example.com', statistics);
```

## Troubleshooting

### Email Not Sending

1. Verify SMTP credentials in `.env`
2. Check if SMTP port is correct (usually 587 for TLS, 465 for SSL)
3. Ensure your email provider allows SMTP access
4. Check firewall settings for outbound SMTP connections

### Database Connection Issues

1. Ensure PostgreSQL is running
2. Verify database credentials in `.env`
3. Check if the database has been initialized with migrations

### Missing Data

- The statistics script only counts non-deleted records
- Active users are those who logged time in the last 30 days
- Hours tracked are calculated from start/stop time log pairs

## Security Considerations

- Email credentials should be kept secure in environment variables
- Admin email addresses should be validated
- The statistics feature only aggregates public metrics
- No sensitive user data (passwords, tokens) is included in reports
