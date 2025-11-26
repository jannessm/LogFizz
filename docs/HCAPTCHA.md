# hCaptcha Integration

This application includes optional hCaptcha integration to protect login and registration forms from bot attacks.

## Overview

hCaptcha is a privacy-focused CAPTCHA service that helps prevent automated abuse while respecting user privacy. When enabled, users must complete a verification challenge before they can log in or register.

## Features

- ✅ Bot protection for login and registration
- ✅ Optional configuration (works without hCaptcha for development)
- ✅ Graceful fallback when not configured
- ✅ Privacy-focused alternative to reCAPTCHA
- ✅ GDPR compliant

## Setup Instructions

### 1. Create an hCaptcha Account

1. Go to [https://www.hcaptcha.com/](https://www.hcaptcha.com/)
2. Sign up for a free account
3. Verify your email address

### 2. Get Your Keys

1. Log in to your hCaptcha dashboard
2. Create a new site or use an existing one
3. You'll need two keys:
   - **Site Key** (public key) - for the frontend
   - **Secret Key** (private key) - for the backend

### 3. Configure Backend

Add the secret key to your backend `.env` file:

```bash
# backend/.env
HCAPTCHA_SECRET_KEY=0x0000000000000000000000000000000000000000
```

**Important:** Keep this secret key private and never commit it to version control!

### 4. Configure Frontend

Add the site key to your frontend `.env` file:

```bash
# frontend/.env
VITE_HCAPTCHA_SITE_KEY=10000000-ffff-ffff-ffff-000000000001
```

### 5. Development Mode

For local development, you can use hCaptcha's test keys:

**Test Site Key (Frontend):**
```
10000000-ffff-ffff-ffff-000000000001
```

**Test Secret Key (Backend):**
```
0x0000000000000000000000000000000000000000
```

⚠️ **Note:** Test keys will always pass validation. Use real keys in production!

## How It Works

### Frontend

1. The `HCaptcha.svelte` component loads the hCaptcha widget
2. Users complete the challenge when logging in or registering
3. Upon successful completion, a token is generated
4. The token is sent with the login/register request

### Backend

1. The backend receives the hCaptcha token with the request
2. The `requireHCaptcha()` utility verifies the token with hCaptcha servers
3. If verification succeeds, the request continues
4. If verification fails, the request is rejected with an error

## Optional Configuration

hCaptcha is **completely optional**. If you don't configure the environment variables:

- **Frontend:** The captcha widget will not be displayed
- **Backend:** Token verification will be skipped with a warning in logs

This allows for flexible deployment:
- ✅ Enable in production for security
- ✅ Disable in development for convenience
- ✅ Enable in staging for testing

## Testing

### Manual Testing

1. Configure test keys (see above)
2. Navigate to the login/register page
3. You should see the hCaptcha widget
4. With test keys, the challenge will always pass

### Automated Testing

For automated tests, you have two options:

1. **Disable hCaptcha:** Don't set environment variables
2. **Mock the verification:** Mock the `requireHCaptcha` function in your tests

Example test mock:

```typescript
// In your test setup
vi.mock('../utils/hcaptcha', () => ({
  requireHCaptcha: vi.fn().mockResolvedValue(undefined),
  isHCaptchaRequired: vi.fn().mockReturnValue(false),
}));
```

## Security Considerations

### Best Practices

1. **Always use HTTPS in production** - Tokens should never be sent over unencrypted connections
2. **Keep secret key secure** - Never expose it in client-side code or public repositories
3. **Use environment variables** - Don't hardcode keys in your source code
4. **Rate limiting** - Combine hCaptcha with rate limiting for better protection
5. **Monitor logs** - Watch for repeated verification failures

### What hCaptcha Protects Against

- ✅ Automated bot registrations
- ✅ Credential stuffing attacks
- ✅ Account enumeration
- ✅ Spam account creation

### What hCaptcha Doesn't Protect Against

- ❌ Valid users with stolen credentials
- ❌ Social engineering attacks
- ❌ SQL injection (use parameterized queries)
- ❌ XSS attacks (use proper output encoding)

## Troubleshooting

### "hCaptcha token is required" Error

**Cause:** Backend has `HCAPTCHA_SECRET_KEY` configured but frontend didn't send a token

**Solution:** Make sure `VITE_HCAPTCHA_SITE_KEY` is set in frontend `.env`

### "hCaptcha verification failed" Error

**Possible causes:**
1. Using test keys in production
2. Token expired (tokens are valid for ~120 seconds)
3. Token already used (tokens are single-use)
4. Network issues connecting to hCaptcha servers
5. Invalid secret key

**Solutions:**
- Check that you're using production keys in production
- Ensure the token is sent immediately after generation
- Don't cache or reuse tokens
- Check backend logs for detailed error messages

### Widget Not Appearing

**Possible causes:**
1. `VITE_HCAPTCHA_SITE_KEY` not set
2. Ad blocker blocking hCaptcha scripts
3. CSP (Content Security Policy) blocking external scripts

**Solutions:**
- Verify environment variable is set and app is rebuilt
- Test in incognito mode or with ad blockers disabled
- Update CSP headers to allow hCaptcha domains

### "Failed to load hCaptcha script" Error

**Cause:** Network issues or blocked external resources

**Solution:** 
- Check browser console for detailed errors
- Ensure `https://js.hcaptcha.com` is accessible
- Check firewall and network settings

## Production Deployment

### Environment Setup

1. Generate production keys from hCaptcha dashboard
2. Set environment variables on your server:

```bash
# Backend
export HCAPTCHA_SECRET_KEY=your_production_secret_key

# Frontend (build time)
export VITE_HCAPTCHA_SITE_KEY=your_production_site_key
```

3. Rebuild frontend with production keys:

```bash
cd frontend
npm run build
```

### Docker Setup

Add environment variables to your `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - HCAPTCHA_SECRET_KEY=${HCAPTCHA_SECRET_KEY}
  
  frontend:
    build:
      args:
        - VITE_HCAPTCHA_SITE_KEY=${VITE_HCAPTCHA_SITE_KEY}
```

### Monitoring

Monitor these metrics in production:

- hCaptcha verification success rate
- Failed verification attempts
- Time to complete challenge (user experience)

## Performance Impact

- **Initial Load:** ~30KB additional JavaScript (lazy loaded)
- **Verification Time:** 1-3 seconds on average
- **Server Impact:** One additional API call per login/register

## Privacy Considerations

hCaptcha is designed with privacy in mind:

- ✅ GDPR compliant
- ✅ No user tracking across sites
- ✅ Privacy-focused alternative to Google reCAPTCHA
- ✅ Users can complete challenges without JavaScript (accessibility mode)

For more information, see [hCaptcha Privacy Policy](https://www.hcaptcha.com/privacy)

## Alternative Configuration

If you prefer not to use hCaptcha, consider these alternatives:

1. **Rate Limiting Only** - Already implemented in the app
2. **Email Verification** - Already implemented in the app
3. **Other CAPTCHA Services** - Modify the integration code
4. **Custom Challenge** - Implement your own verification system

## Resources

- [hCaptcha Documentation](https://docs.hcaptcha.com/)
- [hCaptcha Dashboard](https://dashboard.hcaptcha.com/)
- [hCaptcha API Reference](https://docs.hcaptcha.com/api)
- [hCaptcha Support](https://www.hcaptcha.com/support)

## License & Terms

By using hCaptcha, you agree to:
- [hCaptcha Terms of Service](https://www.hcaptcha.com/terms)
- [hCaptcha Privacy Policy](https://www.hcaptcha.com/privacy)
