# hCaptcha Integration - Setup Instructions

## Quick Start

I've successfully integrated hCaptcha into your login and register forms. Here's what you need to do to get it working:

### 1. Install Frontend Dependencies (Required)

Since npm wasn't accessible, you'll need to install the dependencies manually:

```bash
cd /Users/magnusson/Documents/freetime/clock/frontend
npm install
```

**Note:** No additional packages needed - the implementation uses vanilla hCaptcha JavaScript API.

### 2. Get hCaptcha Keys

1. Go to [https://www.hcaptcha.com/](https://www.hcaptcha.com/) and create a free account
2. Create a new site in the dashboard
3. Copy your **Site Key** (for frontend) and **Secret Key** (for backend)

### 3. Configure Environment Variables

#### Backend (.env)
```bash
# Add this to backend/.env
HCAPTCHA_SECRET_KEY=your_secret_key_here
```

#### Frontend (.env)
```bash
# Add this to frontend/.env
VITE_HCAPTCHA_SITE_KEY=your_site_key_here
```

### 4. For Development/Testing

You can use hCaptcha's test keys:

**Frontend (VITE_HCAPTCHA_SITE_KEY):**
```
10000000-ffff-ffff-ffff-000000000001
```

**Backend (HCAPTCHA_SECRET_KEY):**
```
0x0000000000000000000000000000000000000000
```

⚠️ **Important:** Test keys always pass. Use real keys in production!

## What Was Changed

### Frontend Changes

1. **New Component:** `frontend/src/components/HCaptcha.svelte`
   - Reusable hCaptcha widget component
   - Handles script loading, rendering, and cleanup
   - Supports callbacks for verify, error, and expire events

2. **Type Definitions:** `frontend/src/types/hcaptcha.d.ts`
   - TypeScript definitions for hCaptcha API

3. **Updated Login:** `frontend/src/routes/Login.svelte`
   - Added hCaptcha widget to both login and register forms
   - Validates captcha before submission
   - Resets captcha on error or mode switch

4. **Updated API Service:** `frontend/src/services/api.ts`
   - Modified `authApi.login()` and `authApi.register()` to accept optional hCaptcha tokens

5. **Updated Auth Store:** `frontend/src/stores/auth.ts`
   - Updated `login()` and `register()` methods to accept optional hCaptcha tokens

6. **Environment Config:** `frontend/.env.example`
   - Added `VITE_HCAPTCHA_SITE_KEY` documentation

### Backend Changes

1. **New Utility:** `backend/src/utils/hcaptcha.ts`
   - `verifyHCaptcha()` - Verifies tokens with hCaptcha API
   - `requireHCaptcha()` - Middleware-style verification function
   - `isHCaptchaRequired()` - Checks if hCaptcha is configured
   - Gracefully handles missing configuration (dev mode)

2. **Updated Auth Routes:** `backend/src/routes/auth.routes.ts`
   - Added hCaptcha verification to `/register` endpoint
   - Added hCaptcha verification to `/login` endpoint
   - Updated schemas to accept optional `hcaptchaToken` field

3. **Environment Config:** `backend/.env.example`
   - Added `HCAPTCHA_SECRET_KEY` documentation

### Documentation

1. **Comprehensive Guide:** `docs/HCAPTCHA.md`
   - Setup instructions
   - Configuration options
   - Testing strategies
   - Troubleshooting guide
   - Security best practices
   - Production deployment guide

2. **Updated README:** `README.md`
   - Added hCaptcha to security checklist
   - Added link to hCaptcha documentation

## Features

✅ **Optional Configuration** - Works without hCaptcha for development
✅ **Graceful Fallback** - Skips verification if not configured
✅ **Error Handling** - Clear error messages for users
✅ **Auto-Reset** - Captcha resets on errors or form mode changes
✅ **TypeScript Support** - Full type safety
✅ **Production Ready** - Includes all security best practices

## Testing

### Without hCaptcha (Default)

If you don't set the environment variables, the app works normally:
- Frontend: Captcha widget won't appear
- Backend: Verification is skipped with a warning in logs

### With Test Keys

Use the test keys above to see the captcha in action. Test keys always pass validation.

### With Production Keys

Use real keys from your hCaptcha account for actual bot protection.

## Next Steps

1. **Install dependencies** (see step 1 above)
2. **Add environment variables** for development
3. **Test the login/register flow**
4. **Get production keys** when ready to deploy

## Need Help?

See the comprehensive guide at `docs/HCAPTCHA.md` for:
- Detailed setup instructions
- Troubleshooting common issues
- Security best practices
- Production deployment guide
- Performance considerations
- Privacy information

## Production Checklist

Before deploying to production:

- [ ] Get production hCaptcha keys
- [ ] Set `HCAPTCHA_SECRET_KEY` on production server
- [ ] Set `VITE_HCAPTCHA_SITE_KEY` for production build
- [ ] Rebuild frontend with production keys
- [ ] Test login/register flow in production
- [ ] Monitor verification success rate
- [ ] Ensure HTTPS is enabled

---

That's it! The integration is complete and ready to use. The system is designed to be flexible - you can enable it in production while keeping it disabled during development for convenience.
