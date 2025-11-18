# Email Verification Feature

## Overview
Added email verification functionality that sends a welcome email with a verification link when users register. The verification can be completed without being logged in.

## Features

### 1. **Welcome Email on Registration**
- Automatically sends welcome email when user registers
- Email contains verification link with unique token
- Token expires after 24 hours
- Styled HTML email with call-to-action button

### 2. **Email Verification**
- **No authentication required** - Users can verify their email by clicking the link
- Token-based verification system
- Secure: Tokens are 32-byte random hex strings (64 characters)
- Time-limited: Tokens expire after 24 hours
- One-time use: Token is cleared after successful verification

### 3. **Resend Verification**
- Users can request a new verification email
- Generates fresh token with new expiration
- Security: Doesn't reveal if email exists
- Won't resend if email already verified

## Database Schema

### Updated Users Table
New fields added to `users` table:

```sql
"email_verification_token" character varying,
"email_verification_expires_at" TIMESTAMP WITH TIME ZONE,
"email_verified_at" TIMESTAMP WITH TIME ZONE,
```

**Fields:**
- `email_verification_token` - Unique 64-character hex token
- `email_verification_expires_at` - Token expiration timestamp (24 hours from creation)
- `email_verified_at` - Timestamp when email was verified (NULL if not verified)

## API Endpoints

### 1. POST `/api/auth/verify-email` (No Authentication Required)
Verifies user's email address using token from email link.

**Request:**
```json
{
  "token": "64-character-hex-token"
}
```

**Response (200):**
```json
{
  "message": "Email has been verified successfully"
}
```

**Response (400):**
```json
{
  "error": "Invalid or expired verification token"
}
```

### 2. POST `/api/auth/resend-verification` (No Authentication Required)
Resends verification email to user.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "If an account with that email exists and is not verified, a verification link has been sent."
}
```

Note: Always returns success to prevent email enumeration attacks.

## Service Methods

### AuthService

#### `register(email, password, name, country?, state?)`
- Creates new user
- Generates verification token (32 random bytes, hex encoded)
- Sets expiration to 24 hours from now
- Sends welcome email asynchronously
- Returns user with verification token set

#### `verifyEmail(token)`
- Finds user by token and checks expiration
- Marks email as verified
- Clears verification token and expiration
- Returns `true` on success, `false` if invalid/expired

#### `resendVerificationEmail(email)`
- Finds user by email
- Generates new verification token
- Updates expiration to 24 hours from now
- Sends new welcome email
- Returns `true` always (security - no email enumeration)
- Won't send if email already verified

### EmailService

#### `sendWelcomeEmail(email, verificationToken, userName)`
- Sends HTML email with verification link
- Link format: `${APP_URL}/verify-email?token=${verificationToken}`
- Includes styled button and plain text link
- Mentions 24-hour expiration
- Throws error if sending fails

## Email Template

The welcome email includes:
- Welcome message with user's name
- Call-to-action button (styled in blue)
- Plain text link as fallback
- Expiration notice (24 hours)
- Instructions to ignore if didn't sign up

## Testing

Comprehensive test suite in `src/__tests__/email-verification.test.ts`

### Test Coverage:

#### User Registration
- ✅ Generates verification token on registration
- ✅ Token is 64 characters (32 bytes hex)
- ✅ Sets expiration ~24 hours in future
- ✅ Sends welcome email with verification link

#### Email Verification
- ✅ Verifies email with valid token
- ✅ Fails with invalid token
- ✅ Fails with expired token
- ✅ **Works without being logged in** (key requirement)
- ✅ Clears token after successful verification

#### Resend Verification
- ✅ Generates new token and resends email
- ✅ New token is different from original
- ✅ Doesn't reveal if email exists (security)
- ✅ Won't resend if already verified

#### Complete Flow
- ✅ Full registration → verification flow
- ✅ User can login even without verification (optional)

Run tests:
```bash
npm test email-verification.test.ts
```

## Usage Examples

### Frontend: Registration Flow

```typescript
// 1. User registers
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePassword123',
    name: 'John Doe'
  })
});

// User receives welcome email with verification link
```

### Frontend: Email Verification (No Login Required)

```typescript
// 2. User clicks link in email: /verify-email?token=abc123...
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

const response = await fetch('/api/auth/verify-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token })
});

if (response.ok) {
  // Show success message: "Email verified! You can now login."
  window.location.href = '/login';
} else {
  // Show error: "Invalid or expired verification link"
}
```

### Frontend: Resend Verification

```typescript
// 3. If user didn't receive email or it expired
const response = await fetch('/api/auth/resend-verification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

// Always shows: "If an account exists, verification email has been sent"
```

## Security Features

1. **Token Security**
   - 32-byte cryptographically secure random tokens
   - One-time use (cleared after verification)
   - Time-limited (24-hour expiration)

2. **No Authentication Required**
   - Verification works without login
   - Users can verify before first login
   - Improves user experience

3. **Email Enumeration Protection**
   - Resend endpoint doesn't reveal if email exists
   - Always returns success message

4. **Rate Limiting**
   - Verification endpoint uses `generalAuthRateLimit`
   - Resend endpoint uses `passwordResetRateLimit`
   - Prevents abuse

## Configuration

Environment variables:
- `APP_URL` - Base URL for verification links (default: `http://localhost:3000`)
- `EMAIL_FROM` - Sender email address (default: `noreply@clock-app.com`)
- SMTP configuration (see EmailService for details)

## Notes

- Email verification is **optional** - users can login without verifying
- To make verification **required**, add check in login endpoint:
  ```typescript
  if (!user.email_verified_at) {
    return reply.code(403).send({ error: 'Please verify your email first' });
  }
  ```
- Tokens are stored as plain text (secure random strings, not passwords)
- Failed email sends are logged but don't block registration
- Old tokens automatically become invalid after expiration

## Integration

Files modified:
- ✅ `src/entities/User.ts` - Added verification fields
- ✅ `src/services/auth.service.ts` - Added verification methods
- ✅ `src/services/email.service.ts` - Added welcome email
- ✅ `src/routes/auth.routes.ts` - Added verification endpoints
- ✅ `src/migrations/1699700000000-InitialSchema.ts` - Already had fields

Files created:
- ✅ `src/__tests__/email-verification.test.ts` - Comprehensive test suite

## Future Enhancements

Potential improvements:
1. Add email verification requirement for sensitive operations
2. Add "verify later" reminder emails
3. Add email verification status to user profile
4. Allow changing email with re-verification
5. Add admin dashboard to see verification rates
