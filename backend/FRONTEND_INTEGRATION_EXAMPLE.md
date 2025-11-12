# Frontend Integration Example

This document provides complete examples of how to integrate client-side password hashing into a frontend application.

## Browser-Based Frontend (React, Vue, Angular, etc.)

### Step 1: Create the utility function

```typescript
// utils/clientPasswordHash.ts

/**
 * Client-side password hashing utility for browser environments
 * @param password - The plain-text password
 * @param email - The user's email address
 * @returns A deterministic hash of the password (64-character hex string)
 */
export async function hashPasswordForTransport(
  password: string, 
  email: string
): Promise<string> {
  // Normalize email to lowercase for consistency
  const normalizedEmail = email.toLowerCase().trim();
  
  // Create SHA-256 hash using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(password + normalizedEmail);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### Step 2: Registration Component Example

```typescript
// components/RegisterForm.tsx (React example)
import { useState } from 'react';
import { hashPasswordForTransport } from '../utils/clientPasswordHash';

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Hash the password before sending
      const hashedPassword = await hashPasswordForTransport(password, email);

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password: hashedPassword,  // Send hashed password
          name,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Registration failed');
      }

      const user = await response.json();
      console.log('Registration successful:', user);
      // Redirect to dashboard or login page
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password (min 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
}
```

### Step 3: Login Component Example

```typescript
// components/LoginForm.tsx (React example)
import { useState } from 'react';
import { hashPasswordForTransport } from '../utils/clientPasswordHash';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Hash the password before sending
      const hashedPassword = await hashPasswordForTransport(password, email);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',  // Important: Include cookies
        body: JSON.stringify({
          email,
          password: hashedPassword,  // Send hashed password
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Login failed');
      }

      const user = await response.json();
      console.log('Login successful:', user);
      // Redirect to dashboard
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### Step 4: Password Reset Example

```typescript
// components/ResetPasswordForm.tsx (React example)
import { useState } from 'react';
import { hashPasswordForTransport } from '../utils/clientPasswordHash';

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);

    try {
      // Hash the new password before sending
      const hashedPassword = await hashPasswordForTransport(newPassword, email);

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: hashedPassword,  // Send hashed password
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Password reset failed');
      }

      setSuccess(true);
      // Redirect to login page after a delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return <div>Password reset successful! Redirecting to login...</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="password"
        placeholder="New Password (min 8 characters)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        minLength={8}
        required
      />
      <input
        type="password"
        placeholder="Confirm New Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        minLength={8}
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  );
}
```

## Mobile App (React Native, Flutter, etc.)

### React Native Example

```typescript
// utils/clientPasswordHash.ts (React Native)
import { sha256 } from 'react-native-sha256';

export async function hashPasswordForTransport(
  password: string,
  email: string
): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  const combined = password + normalizedEmail;
  return sha256(combined);
}
```

Note: You'll need to install `react-native-sha256`:
```bash
npm install react-native-sha256
```

## Testing Your Implementation

### Unit Test Example

```typescript
// utils/clientPasswordHash.test.ts
import { hashPasswordForTransport } from './clientPasswordHash';

describe('clientPasswordHash', () => {
  it('should produce consistent hashes', async () => {
    const hash1 = await hashPasswordForTransport('password123', 'user@example.com');
    const hash2 = await hashPasswordForTransport('password123', 'user@example.com');
    expect(hash1).toBe(hash2);
  });

  it('should handle email case insensitivity', async () => {
    const hash1 = await hashPasswordForTransport('password123', 'User@Example.COM');
    const hash2 = await hashPasswordForTransport('password123', 'user@example.com');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different passwords', async () => {
    const hash1 = await hashPasswordForTransport('password1', 'user@example.com');
    const hash2 = await hashPasswordForTransport('password2', 'user@example.com');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce a 64-character hex string', async () => {
    const hash = await hashPasswordForTransport('password123', 'user@example.com');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

## Common Pitfalls to Avoid

### ❌ Don't Do This

```typescript
// WRONG: Sending plain-text password
fetch('/api/auth/login', {
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'plainTextPassword123'  // ❌ BAD!
  })
});

// WRONG: Inconsistent email normalization
const hash = await hashPasswordForTransport(password, email.toUpperCase());  // ❌ BAD!

// WRONG: Not awaiting the async function
const hash = hashPasswordForTransport(password, email);  // ❌ Returns Promise!
```

### ✅ Do This

```typescript
// CORRECT: Hash before sending
const hashedPassword = await hashPasswordForTransport(password, email);
fetch('/api/auth/login', {
  body: JSON.stringify({
    email: 'user@example.com',
    password: hashedPassword  // ✅ GOOD!
  })
});

// CORRECT: Email is normalized by the function
const hash = await hashPasswordForTransport(password, email);  // ✅ GOOD!

// CORRECT: Always await
const hash = await hashPasswordForTransport(password, email);  // ✅ GOOD!
```

## Security Considerations

1. **Always use HTTPS**: Client-side hashing does not replace HTTPS/TLS
2. **Email normalization**: The function handles this automatically
3. **Password requirements**: Apply to plain-text password, not the hash
4. **Store nothing locally**: Never store plain-text passwords in localStorage/sessionStorage
5. **Memory cleanup**: Clear password variables after use when possible

## API Endpoints Summary

All password-related endpoints expect hashed passwords:

- `POST /api/auth/register` - `password` field should be hashed
- `POST /api/auth/login` - `password` field should be hashed  
- `POST /api/auth/reset-password` - `newPassword` field should be hashed
- `PUT /api/auth/change-password` - Both `oldPassword` and `newPassword` should be hashed

## Need Help?

For more details, see:
- `CLIENT_PASSWORD_HASHING.md` - Full protocol specification
- `backend/src/utils/clientPasswordHash.ts` - Reference implementation
- `backend/src/__tests__/clientPasswordHash.test.ts` - Complete test suite
