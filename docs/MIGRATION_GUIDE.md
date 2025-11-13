# Migration Guide - Email Authentication & Holiday Auto-Update

This guide covers the major changes introduced in the latest update.

## Overview

Two major system changes:
1. **Authentication**: Password-based → Email code-based
2. **Holiday Crawler**: Manual updates → Automatic updates with admin notifications

## Breaking Changes

### 1. Authentication System

**Old System:**
- Users register with email + password
- Login with email + password
- Password reset via email token

**New System:**
- Users register with email only (no password)
- Login by requesting a 6-digit code sent to email
- Code expires in 15 minutes
- No password management needed

### 2. Database Schema Changes

**Users Table:**
```sql
-- Removed fields:
password_hash
reset_token
reset_token_expires_at

-- Added fields:
login_code
login_code_expires_at
```

**Holidays Table:**
```sql
-- Added field:
state (nullable)
```

**New Table:**
```sql
-- holiday_metadata table created
```

## Migration Steps

### Step 1: Backup Existing Data
```bash
# Backup your database
pg_dump your_database > backup_before_migration.sql
```

### Step 2: Update Environment Variables

Add to your `.env` file:
```env
# Required for holiday update notifications
ADMIN_EMAIL=admin@yourdomain.com

# Email service configuration (required)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
EMAIL_FROM=noreply@yourdomain.com
APP_URL=https://yourdomain.com
```

### Step 3: Run Migrations

**Option A: Fresh Installation**
```bash
cd backend
npm install
npm run migration:run
```

**Option B: Existing Database**

You'll need to manually migrate the users table:

```sql
-- Backup existing users
CREATE TABLE users_backup AS SELECT * FROM users;

-- Drop and recreate users table
DROP TABLE IF EXISTS users CASCADE;

-- Run the new migration
-- This will create the updated schema
```

Then recreate user accounts (users will need to register again).

### Step 4: Update Frontend/Client Code

**Old Login Flow:**
```javascript
// Old
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
```

**New Login Flow:**
```javascript
// Step 1: Request code
await fetch('/api/auth/request-login-code', {
  method: 'POST',
  body: JSON.stringify({ email })
});

// Step 2: User receives email, enters code
const response = await fetch('/api/auth/verify-login-code', {
  method: 'POST',
  body: JSON.stringify({ email, code })
});
```

**Registration:**
```javascript
// Old
const response = await fetch('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email, password, name, state })
});

// New (no password)
const response = await fetch('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email, name, state })
});
```

## New Features

### 1. Email-Based Authentication

**Benefits:**
- No password to remember
- No password reset flows
- More secure (time-limited codes)
- Simpler user experience

**User Experience:**
1. User enters email
2. Receives 6-digit code
3. Enters code to login
4. Code valid for 15 minutes

### 2. Automatic Holiday Updates

**How It Works:**
- When any holiday API endpoint is called, system checks if German state holidays need updating
- If last update was >3 months ago, triggers automatic update
- Updates last, current, and next year for all 16 German states
- Admin receives email notification with summary

**Admin Email Notification Includes:**
- List of updated states
- Holiday counts per state
- Years updated
- Total holidays updated

**Checking Frequency:**
- System checks once per hour maximum (throttled to avoid overhead)
- Actual update only runs if data is >3 months old
- Updates run in background (don't block API responses)

### 3. State-Specific Holiday Queries

**API Endpoints Now Support State Parameter:**

```bash
# Get holidays for specific German state
GET /api/holidays/DE/2025?state=DE-BW

# Get working days for specific state
GET /api/holidays/workingdays/summary?country=DE&year=2025&state=DE-BY
```

## API Changes

### Removed Endpoints
- `POST /api/auth/login` (replaced by request-login-code + verify-login-code)
- `PUT /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### New Endpoints
- `POST /api/auth/request-login-code` - Request a login code via email
- `POST /api/auth/verify-login-code` - Verify code and login

### Modified Endpoints
- `POST /api/auth/register` - No longer requires `password` field
- `GET /api/holidays/:country/:year` - Now accepts optional `state` query parameter
- `GET /api/holidays/workingdays/summary` - Now accepts optional `state` query parameter
- `POST /api/holidays/` - Now accepts optional `state` field

## Testing

### Test Email Authentication
```bash
# Request login code
curl -X POST http://localhost:3000/api/auth/request-login-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check email for code, then verify
curl -X POST http://localhost:3000/api/auth/verify-login-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456"}'
```

### Test Auto-Update
```bash
# Trigger by calling holiday endpoint
curl http://localhost:3000/api/holidays/DE/2025

# Check logs for auto-update trigger
# Check admin email for notification
```

### Test State-Specific Queries
```bash
# Get holidays for Baden-Württemberg
curl http://localhost:3000/api/holidays/DE/2025?state=DE-BW

# Get working days for Bavaria
curl http://localhost:3000/api/holidays/workingdays/summary?country=DE&year=2025&state=DE-BY
```

## Rollback Plan

If you need to rollback:

### Step 1: Restore Database
```bash
psql your_database < backup_before_migration.sql
```

### Step 2: Checkout Previous Code
```bash
git checkout <previous_commit_hash>
npm install
```

### Step 3: Restart Services
```bash
npm run dev
```

## Troubleshooting

### Email Not Sending
Check:
- SMTP credentials in `.env`
- SMTP server accessibility
- Email service logs
- Firewall rules

### Auto-Update Not Triggering
Check:
- Holiday API endpoints are being called
- Check is throttled to once per hour
- Check application logs
- Verify ADMIN_EMAIL is set

### Users Can't Login
- Verify email service is working
- Check login codes are being generated
- Verify codes haven't expired (15 min limit)
- Check database for login_code field

### State Holidays Missing
- Run manual update: `npm run holiday:state:init`
- Check API connectivity to Nager.Date
- Verify database has holiday_metadata table
- Check logs for errors

## Support

For issues or questions:
1. Check application logs
2. Verify environment variables
3. Test email service independently
4. Review migration steps
5. Check database schema matches expected structure

## Security Considerations

### Email Codes
- 6-digit codes provide ~1 million combinations
- 15-minute expiry limits brute force window
- Rate limiting on login endpoints recommended
- Codes are single-use (deleted after successful verification)

### Admin Notifications
- Only sent to ADMIN_EMAIL (not exposed to users)
- Contains summary only (no sensitive data)
- Sent asynchronously (doesn't block API)

### Database
- login_code stored in plain text (acceptable as it's short-lived and single-use)
- Proper indexes on lookups
- Soft deletes maintained for users

## Performance Impact

### Auto-Update
- Checks throttled to once per hour
- Updates run in background
- No blocking of API responses
- Typical update: 1-2 minutes for all states

### Email Authentication
- Slightly slower than password (email latency)
- Reduced server load (no password hashing on every login)
- Better security posture

---

**Last Updated:** November 2025  
**Version:** 2.0.0
