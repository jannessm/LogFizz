# Paywall and Payment System

This document describes the paywall and payment system implemented for TapShift.

## Overview

TapShift includes a subscription-based paywall that can be enabled or disabled by administrators. The system provides:

- **2-month free trial** for all new users
- **€5 per year** subscription via Stripe
- **Admin control** to enable/disable the paywall globally
- **Automatic subscription management** including renewals and cancellations

## Setup

### 1. Stripe Configuration

1. Create a Stripe account at https://stripe.com
2. Get your API keys from https://dashboard.stripe.com/apikeys
3. Set up a webhook endpoint in Stripe dashboard:
   - URL: `https://your-domain.com/api/payment/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Get the webhook secret

### 2. Environment Variables

Add the following to your backend `.env` file:

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

For production, use your live Stripe keys instead of test keys.

### 3. Frontend Configuration

Add Stripe publishable key to your frontend environment (if needed for advanced integration):

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
```

## Database Schema

The paywall system adds the following fields to the `users` table:

- `subscription_status`: 'trial' | 'active' | 'expired' | 'canceled'
- `subscription_end_date`: Date when the current subscription period ends
- `trial_end_date`: Date when the trial period ends (2 months from registration)
- `stripe_customer_id`: Stripe customer ID
- `stripe_subscription_id`: Stripe subscription ID

A new `settings` table is created to store global settings:

- `key`: Setting name (e.g., 'paywall_enabled')
- `value`: Setting value ('true' or 'false')

## API Endpoints

### Public Endpoints

- `GET /api/payment/paywall-status` - Check if paywall is enabled

### Authenticated Endpoints

- `POST /api/payment/create-checkout-session` - Create Stripe checkout session
- `GET /api/payment/subscription-status` - Get current user's subscription status
- `POST /api/payment/cancel-subscription` - Cancel current subscription

### Admin Endpoints

⚠️ **Security Note**: The admin endpoint currently accepts any authenticated user. In production, implement proper admin role validation.

- `POST /api/payment/admin/toggle-paywall` - Enable/disable paywall globally

### Webhook Endpoint

- `POST /api/payment/webhook` - Stripe webhook handler (requires valid Stripe signature)

## User Flow

### New User Registration

1. User registers for an account
2. `trial_end_date` is automatically set to 2 months from registration
3. `subscription_status` is set to 'trial'
4. User has full access during trial period

### Trial Expiration

1. When paywall is enabled and trial expires:
   - User is redirected to `/payment` page
   - Dashboard shows warning 7 days before expiration
2. User can subscribe via Stripe checkout
3. Upon successful payment:
   - `subscription_status` changes to 'active'
   - `subscription_end_date` is set to 1 year from now
   - Stripe manages automatic renewals

### Subscription Management

Users can manage their subscription from Settings:
1. Navigate to Settings
2. Click "Manage Subscription"
3. View current status, trial/subscription end dates
4. Subscribe or cancel as needed

### Admin Control

To enable/disable the paywall:

```bash
# Using curl
curl -X POST http://localhost:3000/api/payment/admin/toggle-paywall \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

Or via the frontend (if admin UI is implemented).

## Frontend Components

### Payment Page (`/payment`)

Displays:
- Current subscription status
- Trial remaining days
- Subscription pricing and features
- Stripe checkout button
- Subscription cancellation (for active subscribers)

### Payment Success Page (`/payment/success`)

Confirmation page shown after successful Stripe checkout.

### Settings Integration

A "Manage Subscription" button is added to the Settings page for easy access.

## Testing

### Test the Trial Period

1. Register a new user
2. Check that `trial_end_date` is set to 2 months from now
3. Verify user has full access during trial

### Test Stripe Integration (Test Mode)

Use Stripe test cards: https://stripe.com/docs/testing

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Authentication required: `4000 0025 0000 3155`

### Test Paywall

1. Enable paywall via admin endpoint
2. Set a user's `trial_end_date` to past date
3. Verify user is redirected to payment page
4. Disable paywall
5. Verify user has access again

## Subscription Middleware

The `requireSubscription` middleware in `backend/src/utils/subscription.ts` checks:

1. Is paywall enabled? If not, allow access
2. Is user authenticated? If not, return 401
3. Does user have valid subscription or trial? If not, return 402 (Payment Required)

Apply this middleware to routes that should be protected by the paywall.

## Important Notes

1. **No Migration Needed**: The schema changes are included in the initial migration
2. **No Backward Compatibility Code**: All users will have the subscription fields
3. **Admin Authorization**: The admin endpoint needs proper role-based access control before production use
4. **Stripe Webhooks**: Make sure to configure webhooks in Stripe dashboard for production
5. **SSL Required**: Stripe requires HTTPS for webhooks in production

## Future Improvements

1. **Admin Role System**: Add proper admin role validation
2. **Email Notifications**: Send emails when trial is expiring, subscription renews, or payment fails
3. **Grace Period**: Add grace period after subscription expires before blocking access
4. **Multiple Plans**: Support different subscription tiers (monthly, yearly, lifetime)
5. **Promo Codes**: Implement Stripe coupon codes for discounts
6. **Subscription Analytics**: Track subscription metrics and revenue
