# Backend Scripts

This directory contains utility scripts for the Clock application backend.

## Available Scripts

### Seed Script (`seed.ts`)

Seeds the database with sample data for development and testing purposes.

**Usage:**
```bash
npm run seed
```

**What it creates:**
- **2 Sample Users:**
  - `demo@example.com` (password: `demo123`) - with state Berlin
  - `test@example.com` (password: `test123`) - with state Bayern

- **5 Sample Buttons:**
  - Work (💼) - with 8-hour goal on weekdays, auto-subtract breaks enabled
  - Study (📚) - with 2-hour goal on weekdays
  - Exercise (🏃) - with 1-hour goal on Mon/Wed/Fri
  - Side Project (🚀) - with 3-hour goal on weekends
  - Meetings (📞) - for the test user

- **Sample Time Logs:**
  - Work sessions for past 7 weekdays (9 AM - 5:30 PM)
  - Study sessions for some evenings
  - Exercise sessions on Mon/Wed/Fri mornings
  - Side project sessions on weekends
  - One active timer (started 2 hours ago)

- **9 Sample Holidays:**
  - US holidays (New Year's Day, Independence Day, Thanksgiving, Christmas)
  - German holidays (Neujahr, Tag der Arbeit, Tag der Deutschen Einheit, Weihnachten)

**Important Notes:**
- ⚠️ This script will **clear all existing data** in development environments
- Only run this in development/testing environments, never in production
- The script checks `NODE_ENV` to prevent running in production

### Holiday Crawler Script (`holiday-crawler.ts`)

Crawls and imports holiday data from external sources.

**Usage:**
```bash
# Crawl holidays for configured countries
npm run holiday:crawl

# Refresh existing holiday data
npm run holiday:refresh

# Initialize holidays for all countries
npm run holiday:init
```

## Running Scripts

All scripts can be run using npm commands defined in `package.json`:

```bash
# Seed the database with sample data
npm run seed

# Run holiday crawler
npm run holiday:crawl
npm run holiday:refresh
npm run holiday:init

# Database migrations
npm run migration:generate
npm run migration:run
npm run migration:revert

# Maintenance tasks
npm run maintenance
```

## Development Workflow

For a fresh development setup:

1. Set up environment variables (`.env` file)
2. Start the database (PostgreSQL)
3. Run migrations if needed: `npm run migration:run`
4. Seed the database: `npm run seed`
5. Start the development server: `npm run dev`

You can now login with `demo@example.com` / `demo123` to see sample data.
