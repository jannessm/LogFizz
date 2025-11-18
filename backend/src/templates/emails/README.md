# Email Templates

This directory contains the email template system for the Clock App backend.

## Overview

The email template system provides a consistent, professional look and feel for all emails sent by the application. It consists of:

1. **Base Template** (`base.template.ts`) - Main layout and styling
2. **Specific Email Templates** - Content for different email types

## Architecture

### Base Template (`base.template.ts`)

The base template provides:
- Consistent header with Clock App branding (⏰ icon and gradient header)
- Professional styling with responsive design
- Standardized footer with links and copyright
- Both HTML and plain text generation
- Mobile-friendly layout

**Key Features:**
- Gradient blue header for brand identity
- Clean, modern design with proper spacing
- Accessible colors and typography
- Responsive design for mobile devices
- Plain text fallback for email clients that don't support HTML

### Email-Specific Templates

Each email type (welcome, password reset, etc.) has its own template file that:
- Defines the specific content structure
- Uses the base template for consistent layout
- Generates both HTML and plain text versions

## Current Email Templates

### 1. Welcome Email (`welcome.template.ts`)

**Purpose:** Sent when a new user registers

**Content:**
- Greeting with user's name
- Welcome message explaining the app
- Email verification button (prominent call-to-action)
- Verification link in code block format
- Expiration notice (24 hours)
- Security note about ignoring if not requested

**Function:** `generateWelcomeEmail(data: WelcomeEmailData)`

### 2. Password Reset Email (`password-reset.template.ts`)

**Purpose:** Sent when a user requests a password reset

**Content:**
- Greeting with user's name
- Explanation of the request
- Password reset button (prominent call-to-action)
- Reset link in code block format
- Expiration notice (1 hour)
- Security notes about ignoring and not sharing

**Function:** `generatePasswordResetEmail(data: PasswordResetEmailData)`

## Usage

### In Email Service

```typescript
import { generateWelcomeEmail } from '../templates/emails/welcome.template.js';

const emailContent = generateWelcomeEmail({
  userName: 'John Doe',
  verificationUrl: 'https://app.example.com/verify?token=abc123',
  appUrl: 'https://app.example.com',
});

// Send email
await transporter.sendMail({
  from: 'noreply@clock-app.com',
  to: user.email,
  subject: 'Welcome to Clock App',
  html: emailContent.html,
  text: emailContent.text,
});
```

## Adding New Email Templates

To add a new email template:

1. Create a new file in this directory (e.g., `new-feature.template.ts`)
2. Import the base template functions
3. Define the data interface for your email
4. Create a content generation function
5. Create a main generation function that uses the base template
6. Export the generation function

**Example:**

```typescript
import { generateEmailTemplate, generatePlainTextEmail, EmailTemplateData } from './base.template.js';

export interface MyEmailData {
  userName: string;
  customUrl: string;
  appUrl: string;
}

export function generateMyEmailContent(data: MyEmailData): string {
  return `
    <h1>Custom Email Title</h1>
    <p>Hi ${data.userName},</p>
    <p>Your custom content here...</p>
    <p style="text-align: center;">
      <a href="${data.customUrl}" class="button">Action Button</a>
    </p>
  `;
}

export function generateMyEmail(data: MyEmailData): { html: string; text: string } {
  const content = generateMyEmailContent(data);
  
  const templateData: EmailTemplateData = {
    title: 'Your Email Title',
    preheader: 'Short preview text',
    content,
    appUrl: data.appUrl,
  };
  
  return {
    html: generateEmailTemplate(templateData),
    text: generatePlainTextEmail({
      ...templateData,
      content: 'Plain text version of your email...',
    }),
  };
}
```

## Design Guidelines

When creating email content:

1. **Keep it concise** - Users scan emails quickly
2. **Clear call-to-action** - Use the `.button` class for primary actions
3. **Use dividers** - Separate sections with `.divider` class
4. **Important info** - Use code blocks (`.code-block`) for links/codes to copy
5. **Mobile-first** - Test on mobile devices
6. **Accessibility** - Use semantic HTML and proper color contrast
7. **Plain text** - Always provide a meaningful plain text version

## Styling Classes

Available CSS classes from the base template:

- `.button` - Primary call-to-action button (blue)
- `.code-block` - Display code or links with copy-friendly formatting
- `.divider` - Horizontal separator line
- Standard HTML tags: `<h1>`, `<p>`, `<a>`, etc.

## Testing

Email templates are tested indirectly through the email service tests. To visually test emails:

1. Set up a local SMTP server (e.g., MailHog, smtp4dev)
2. Configure environment variables to point to the test server
3. Trigger the email sending in your local environment
4. View the email in the test server's web UI

## Browser Compatibility

The email templates are designed to work with:
- Modern email clients (Gmail, Outlook, Apple Mail, etc.)
- Webmail interfaces
- Mobile email apps
- Plain text email clients (fallback)

## Security Considerations

### Email Content Security
- Never include sensitive data in emails
- Always use HTTPS links
- Include expiration times for time-sensitive links
- Add security notices (e.g., "If you didn't request this...")
- Don't use email for authentication (use tokens)

### Template Security Model
**IMPORTANT**: The email template system is designed to work ONLY with trusted, hard-coded template content defined in TypeScript files. 

- ✅ **Safe**: Using templates with static content from `.template.ts` files
- ✅ **Safe**: Inserting user names, URLs, and dates into template placeholders
- ❌ **UNSAFE**: Using `generatePlainTextEmail()` with user-provided HTML
- ❌ **UNSAFE**: Inserting raw user content into template HTML

The `generatePlainTextEmail()` function strips HTML tags but is NOT a security sanitizer. It assumes the input comes from our own trusted templates, not from users. User-provided content should NEVER be passed to this function or inserted directly into email templates without proper escaping.
