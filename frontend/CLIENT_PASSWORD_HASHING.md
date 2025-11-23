# Client-Side Password Hashing Implementation

## Overview

This implementation adds client-side password hashing to prevent plain-text passwords from being transmitted over the network, providing an additional layer of security (defense-in-depth).

## Important Note

**This is NOT a replacement for server-side password hashing!** The backend still applies bcrypt hashing to the received hashes for secure storage. Client-side hashing only protects passwords during network transmission.

## Implementation Details

### Frontend Changes

#### 1. Password Hashing Utility (`/frontend/src/utils/passwordHash.ts`)

A browser-compatible version of the password hashing function using the Web Crypto API:

```typescript
async function hashPasswordForTransport(password: string, email: string): Promise<string>
```

**Features:**
- Uses SHA-256 for deterministic hashing
- Combines password + normalized email (lowercase, trimmed) for uniqueness
- Returns a 64-character hex string
- Fully browser-compatible using `crypto.subtle.digest`

#### 2. API Service Updates (`/frontend/src/services/api.ts`)

Updated the following methods to hash passwords before transmission:

- **`register()`**: Hashes password with email before sending
- **`login()`**: Hashes password with email before sending
- **`changePassword()`**: Hashes both old and new passwords
- **`resetPassword()`**: Hashes new password (now requires email parameter)

### Backend Changes

#### 1. Auth Routes (`/backend/src/routes/auth.routes.ts`)

- Updated `/reset-password` endpoint to accept optional `email` parameter for additional verification

#### 2. Auth Service (`/backend/src/services/auth.service.ts`)

- Updated `resetPassword()` method to accept optional email and verify it matches the token's user

### Testing

Added comprehensive test suite in `/frontend/src/test/passwordHash.test.ts` to verify:
- Deterministic hashing
- Different inputs produce different hashes
- Email normalization (lowercase, trim)
- Output format (64-character hex string)

## Usage Example

```typescript
// Before (plain-text password)
await authApi.login('user@example.com', 'myPlainTextPassword');

// After (automatically hashed)
await authApi.login('user@example.com', 'myPlainTextPassword');
// Internally sends: { email: 'user@example.com', password: 'a1b2c3d4...' (hash) }
```

## Security Benefits

1. **Network Protection**: Plain-text passwords never traverse the network
2. **TLS Compromise**: Even if TLS is compromised, attackers only see hashes
3. **Logging Safety**: If requests are logged, passwords aren't exposed
4. **Defense-in-Depth**: Multiple layers of security

## Breaking Change: resetPassword()

The `resetPassword()` function now requires the user's email as a third parameter:

```typescript
// Old
await authApi.resetPassword(token, newPassword);

// New
await authApi.resetPassword(token, newPassword, userEmail);
```

**Note**: The email should be obtained from the user during the password reset flow or stored from the initial forgot-password request.

## Compatibility

The backend accepts both hashed and unhashed passwords for a transition period. The `email` parameter in `/reset-password` is optional for backward compatibility.

## Migration Checklist

- [x] Create password hashing utility
- [x] Update register endpoint to hash passwords
- [x] Update login endpoint to hash passwords
- [x] Update changePassword endpoint to hash passwords
- [x] Update resetPassword endpoint to hash passwords and accept email
- [x] Add comprehensive tests
- [ ] Update frontend components that use resetPassword to pass email
- [ ] Update documentation
