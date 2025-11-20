# Email Template Preview

This document provides a preview of the email templates used in the Clock App.

## Welcome Email Template

### Visual Structure

```
┌────────────────────────────────────────┐
│  [Gradient Blue Header]                │
│                                        │
│          ⏰ (Clock Icon)               │
│        Clock App (White Text)         │
│                                        │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  [White Content Area]                  │
│                                        │
│  Welcome to Clock App!                 │
│                                        │
│  Hi [User Name],                       │
│                                        │
│  Thank you for signing up! We're       │
│  excited to have you on board.         │
│                                        │
│  Clock App helps you track your time   │
│  efficiently with customizable         │
│  buttons, automatic logging, and       │
│  insightful statistics.                │
│                                        │
│  ─────────────────────────────────     │
│                                        │
│  Please verify your email address      │
│  to get started:                       │
│                                        │
│    [Verify Email Address] (Button)    │
│                                        │
│  Or copy and paste this link:          │
│  ┌──────────────────────────────────┐ │
│  │ https://app.com/verify?token=... │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ─────────────────────────────────     │
│                                        │
│  ⚠️ This verification link will        │
│  expire in 24 hours.                   │
│                                        │
│  If you didn't create an account,      │
│  please ignore this email.             │
│                                        │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  [Gray Footer]                         │
│                                        │
│  Thank you for using Clock App!        │
│                                        │
│  Visit Clock App | Help Center |       │
│  Privacy Policy                        │
│                                        │
│  © 2025 Clock App. All rights          │
│  reserved.                             │
│                                        │
└────────────────────────────────────────┘
```

### Key Features
- **Gradient blue header** (from #3B82F6 to #2563EB)
- **Clock icon** (⏰) for immediate brand recognition
- **Clear hierarchy** with h1 for title, regular paragraphs for content
- **Prominent CTA button** in blue with white text
- **Code block** for easy link copying
- **Security notices** with warning emoji
- **Professional footer** with links and copyright

---

## Password Reset Email Template

### Visual Structure

```
┌────────────────────────────────────────┐
│  [Gradient Blue Header]                │
│                                        │
│          ⏰ (Clock Icon)               │
│        Clock App (White Text)         │
│                                        │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  [White Content Area]                  │
│                                        │
│  Password Reset Request                │
│                                        │
│  Hi [User Name],                       │
│                                        │
│  We received a request to reset the    │
│  password for your Clock App account.  │
│                                        │
│  If you made this request, click the   │
│  button below to reset your password:  │
│                                        │
│    [Reset Your Password] (Button)     │
│                                        │
│  Or copy and paste this link:          │
│  ┌──────────────────────────────────┐ │
│  │ https://app.com/reset?token=...  │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ─────────────────────────────────     │
│                                        │
│  ⚠️ This password reset link will      │
│  expire in 1 hour.                     │
│                                        │
│  🔒 If you didn't request a password   │
│  reset, please ignore this email.      │
│  Your password will remain unchanged,  │
│  and your account is secure.           │
│                                        │
│  For security reasons, we recommend    │
│  that you don't share this email.      │
│                                        │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  [Gray Footer]                         │
│                                        │
│  Thank you for using Clock App!        │
│                                        │
│  Visit Clock App | Help Center |       │
│  Privacy Policy                        │
│                                        │
│  © 2025 Clock App. All rights          │
│  reserved.                             │
│                                        │
└────────────────────────────────────────┘
```

### Key Features
- **Same consistent header** as welcome email
- **Clear action request** with prominent button
- **Multiple security notices** with emoji for emphasis
- **Short expiration time** (1 hour) for security
- **Reassurance** if user didn't make the request

---

## Design Principles

### Color Palette
- **Primary Blue**: #3B82F6 (buttons, header gradient start)
- **Dark Blue**: #2563EB (header gradient end, hover states)
- **Dark Gray**: #1f2937 (headings)
- **Medium Gray**: #4b5563 (body text)
- **Light Gray**: #6b7280 (secondary text, footer)
- **Background Gray**: #f5f5f5 (page background)
- **White**: #ffffff (content area)

### Typography
- **Font Family**: System fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, etc.)
- **Heading Size**: 24px
- **Body Size**: 16px
- **Footer Size**: 14px
- **Line Height**: 1.6 for readability

### Responsive Design
- **Max Width**: 600px (optimal for email clients)
- **Mobile Breakpoint**: 600px
- **Padding adjustments** for smaller screens
- **Touch-friendly** button sizes

### Accessibility
- **Color Contrast**: WCAG AA compliant
- **Semantic HTML**: Proper heading hierarchy
- **Alt Text**: Provided where needed
- **Plain Text Version**: Always included

### Security Best Practices
- **Time-limited links** with clear expiration notices
- **Warning messages** for unexpected emails
- **HTTPS links** only
- **No sensitive data** in email body
- **Clear origination** from Clock App

---

## Plain Text Version

Both templates also generate clean plain text versions for email clients that don't support HTML:

```
════════════════════════════════════════
⏰ Clock App
════════════════════════════════════════

Welcome to Clock App

Hi John Doe,

Thank you for signing up! We're excited to have you on board.

Clock App helps you track your time efficiently with customizable 
buttons, automatic logging, and insightful statistics.

Please verify your email address by clicking the link below:
https://app.example.com/verify-email?token=abc123

This verification link will expire in 24 hours.

If you didn't create an account, please ignore this email and no 
account will be created.

────────────────────────────────────────
Thank you for using Clock App!

Visit Clock App: https://app.example.com
Help Center: https://app.example.com/help
Privacy Policy: https://app.example.com/privacy

© 2025 Clock App. All rights reserved.
```

---

## Testing the Templates

To test how these templates look:

1. **Local SMTP Server**: Use MailHog or smtp4dev
2. **Trigger Registration**: Create a test account
3. **View in Email Client**: Check the rendered HTML
4. **Test Mobile**: View on mobile devices
5. **Test Plain Text**: Check plain text version

## Future Enhancements

Potential additions to the template system:

- Account confirmation emails
- Activity summary emails
- Team invitation emails
- Export ready notification emails
- Billing/subscription emails
- Security alert emails
