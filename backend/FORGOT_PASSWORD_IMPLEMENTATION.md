# Forgot Password Feature Implementation

## Overview
This implementation adds a complete forgot password/password reset feature with email notifications and comprehensive tests.

## What Was Added

### 1. Database Schema Changes
- **File**: `backend/src/entities/User.ts`
  - Added `reset_token` field to store password reset tokens
  - Added `reset_token_expires_at` field to track token expiration (1 hour validity)

- **File**: `backend/src/migrations/1731312000000-AddResetTokenToUser.ts`
  - Migration to add the new columns to the users table
  - Run migration with: `npm run migration:run`

### 2. Email Service
- **File**: `backend/src/services/email.service.ts`
  - New service for sending password reset emails via nodemailer
  - Configurable SMTP settings through environment variables
  - Generates HTML and plain text email templates
  - Mock mode for testing environment

### 3. Authentication Service Updates
- **File**: `backend/src/services/auth.service.ts`
  - `requestPasswordReset(email)`: Generates secure token, sets expiration, sends email
  - `resetPassword(token, newPassword)`: Validates token, updates password, clears token
  - Security: Doesn't reveal if user exists or not

### 4. API Endpoints
- **File**: `backend/src/routes/auth.routes.ts`

#### POST `/api/auth/forgot-password`
Request body:
```json
{
  "email": "user@example.com"
}
```
Response (always 200 for security):
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

#### POST `/api/auth/reset-password`
Request body:
```json
{
  "token": "reset-token-from-email",
  "newPassword": "newpassword123"
}
```
Success response (200):
```json
{
  "message": "Password has been reset successfully"
}
```
Error response (400):
```json
{
  "error": "Invalid or expired reset token"
}
```

### 5. Comprehensive Tests
- **File**: `backend/src/__tests__/auth.test.ts`
  - Test forgot password request for existing user
  - Test forgot password request for non-existing user (security test)
  - Test successful password reset with valid token
  - Test password reset rejection with invalid token
  - Test password reset rejection with expired token
  - Test token clearing after successful reset
  - Test token reuse prevention
  - Test password length validation

## Environment Variables

Add these to your `.env` file for production:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@clock-app.com

# Application URL (used in email links)
APP_URL=http://localhost:3000
```

## Dependencies

The implementation requires nodemailer. Install with:
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

## Security Features

1. **Token Security**: Uses crypto.randomBytes(32) for secure token generation
2. **Email Enumeration Prevention**: Always returns same message regardless of user existence
3. **Token Expiration**: Tokens expire after 1 hour
4. **One-Time Use**: Tokens are cleared after successful password reset
5. **Password Validation**: Enforces minimum 8 character password length

## Testing

Run tests with:
```bash
npm run test
```

The tests use a mock email configuration that doesn't require actual SMTP setup.

## Usage Flow

1. User requests password reset via `/api/auth/forgot-password`
2. System generates secure token and sends email with reset link
3. User clicks link in email (format: `{APP_URL}/reset-password?token={token}`)
4. Frontend collects new password and submits to `/api/auth/reset-password`
5. System validates token, updates password, and clears token
6. User can now login with new password

## Notes

- Tokens are valid for 1 hour from generation
- The same email template is sent whether user exists or not (security)
- Failed email sends are logged but don't prevent the flow from continuing
- In test environment, emails aren't actually sent but the flow still works
