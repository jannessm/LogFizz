# Client-Side Password Hashing Protocol

## Overview

This application uses client-side password hashing to provide defense-in-depth security. Before sending passwords to the API, clients must hash them using the protocol described below.

## Why Client-Side Hashing?

Client-side password hashing ensures that:
1. **Plain-text passwords never traverse the network** - Even if network traffic is intercepted, the original password is not exposed
2. **Defense-in-depth** - Multiple layers of security (client hash + backend bcrypt)
3. **Protection against passive monitoring** - Network administrators or attackers monitoring traffic cannot see actual passwords

## Protocol

### Hash Function

The client must hash passwords using **SHA-256** with the following algorithm:

```
hash = SHA256(password + normalized_email)
```

Where:
- `password` is the user's plain-text password
- `normalized_email` is the user's email address converted to lowercase and trimmed of whitespace
- The result is a 64-character hexadecimal string

### Implementation

#### JavaScript/TypeScript (Node.js)

```javascript
import crypto from 'crypto';

function hashPasswordForTransport(password, email) {
  const normalizedEmail = email.toLowerCase().trim();
  const hash = crypto.createHash('sha256');
  hash.update(password);
  hash.update(normalizedEmail);
  return hash.digest('hex');
}
```

#### JavaScript (Browser)

```javascript
async function hashPasswordForTransport(password, email) {
  const normalizedEmail = email.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(password + normalizedEmail);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

#### Python

```python
import hashlib

def hash_password_for_transport(password: str, email: str) -> str:
    normalized_email = email.lower().strip()
    hash_obj = hashlib.sha256()
    hash_obj.update(password.encode('utf-8'))
    hash_obj.update(normalized_email.encode('utf-8'))
    return hash_obj.hexdigest()
```

## Usage

### Registration

When registering a new user:

```javascript
const email = 'user@example.com';
const plainPassword = 'mySecurePassword123';
const hashedPassword = hashPasswordForTransport(plainPassword, email);

// Send to API
fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: email,
    password: hashedPassword,  // Send hashed password, not plain text
    name: 'John Doe'
  })
});
```

### Login

When logging in:

```javascript
const email = 'user@example.com';
const plainPassword = 'mySecurePassword123';
const hashedPassword = hashPasswordForTransport(plainPassword, email);

// Send to API
fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: email,
    password: hashedPassword  // Send hashed password, not plain text
  })
});
```

### Password Reset

When resetting a password:

```javascript
const email = 'user@example.com';  // The user's email
const newPlainPassword = 'myNewPassword456';
const hashedNewPassword = hashPasswordForTransport(newPlainPassword, email);

// Send to API
fetch('/api/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: resetToken,
    newPassword: hashedNewPassword  // Send hashed password, not plain text
  })
});
```

### Change Password

When changing a password:

```javascript
const email = 'user@example.com';  // Current user's email
const oldPlainPassword = 'myOldPassword123';
const newPlainPassword = 'myNewPassword456';
const hashedOldPassword = hashPasswordForTransport(oldPlainPassword, email);
const hashedNewPassword = hashPasswordForTransport(newPlainPassword, email);

// Send to API
fetch('/api/auth/change-password', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    oldPassword: hashedOldPassword,  // Send hashed password
    newPassword: hashedNewPassword   // Send hashed password
  })
});
```

## Important Notes

1. **Email Normalization**: Always normalize the email to lowercase and trim whitespace before hashing. This ensures consistency.

2. **Backend Security**: The backend will still apply bcrypt hashing to the client-hashed password. The client hash is NOT the final stored hash.

3. **No Additional Security Requirements**: This protocol provides network-level protection. The backend still handles all authentication and authorization.

4. **Password Requirements**: Password length requirements (minimum 8 characters) apply to the plain-text password, not the hash.

5. **Deterministic**: The same password + email combination will always produce the same hash, which is required for authentication to work.

## Security Considerations

- **This is NOT a replacement for HTTPS**: Always use HTTPS/TLS for API communication
- **Server-side validation remains critical**: The backend still performs all security checks
- **Prevents credential stuffing attacks**: Different sites will produce different hashes even with the same password
- **Email as salt**: Using email as part of the hash means changing email requires password re-entry

## Testing

A test utility is provided in the backend at:
```
backend/src/utils/clientPasswordHash.ts
```

Tests are available at:
```
backend/src/__tests__/clientPasswordHash.test.ts
```

## References

- SHA-256: https://en.wikipedia.org/wiki/SHA-2
- Defense in Depth: https://en.wikipedia.org/wiki/Defense_in_depth_(computing)
