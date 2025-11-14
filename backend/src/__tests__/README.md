# Testing Guide

## Running Tests

Tests require a PostgreSQL database to be running. Follow these steps to run tests locally:

### 1. Start PostgreSQL Database

Using Docker:
```bash
docker run -d \
  --name clock-test-db \
  -e POSTGRES_USER=clock_user \
  -e POSTGRES_PASSWORD=clock_password \
  -e POSTGRES_DB=clock_test_db \
  -p 5432:5432 \
  postgres:15
```

Or use your local PostgreSQL installation.

### 2. Set Environment Variables

Create a `.env.test` file or set environment variables:
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_USERNAME=clock_user
export DB_PASSWORD=clock_password
export DB_DATABASE=clock_test_db
export NODE_ENV=test
```

### 3. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- auth.test.ts

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

## Test Structure

### Authentication Tests (`auth.test.ts`)
Tests the email-based authentication system:
- User registration (no password required)
- Login code request
- Login code verification
- Code expiry and single-use behavior
- Session management

### Holiday Crawler Tests (`holiday-crawler.test.ts`)
Tests the holiday data fetching system:
- Most tests are skipped by default (require external API)
- Can be enabled for integration testing

### Other Test Files
- `clientPasswordHash.test.ts` - Client-side password hashing for transport
- `timelog.test.ts` - Time log functionality
- `button.test.ts` - Button management
- `breaks.test.ts` - Break calculation
- `rateLimit.test.ts` - Rate limiting
- `sync.test.ts` - Data synchronization

## Test Configuration

- **vitest.config.ts**: Main test configuration
- **setup.ts**: Global test setup (creates test database)
- **testSetup.ts**: Per-test file setup (initializes database connection)
- **testDatabase.ts**: Database utilities for tests

## Notes

### Email Authentication
Since tests use email authentication, login codes are generated and stored in the database. Tests access the database directly to retrieve codes for verification.

### Database State
Tests use a dedicated test database (`clock_test_db`) that is cleaned between test runs to ensure isolation.

### Skipped Tests
Some tests are skipped by default because they:
- Require external API access (Nager.Date API)
- Take a long time to run
- Are integration tests rather than unit tests

To run skipped tests, remove the `.skip` modifier.

## CI/CD

In CI/CD environments, you'll need to:
1. Set up PostgreSQL service
2. Configure environment variables
3. Run migrations if needed
4. Execute tests

Example GitHub Actions:
```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: clock_user
      POSTGRES_PASSWORD: clock_password
      POSTGRES_DB: clock_test_db
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

steps:
  - name: Run tests
    env:
      DB_HOST: localhost
      DB_PORT: 5432
      DB_USERNAME: clock_user
      DB_PASSWORD: clock_password
      DB_DATABASE: clock_test_db
      NODE_ENV: test
    run: npm test
```

## Troubleshooting

### "Cannot connect to database"
- Ensure PostgreSQL is running
- Check connection credentials
- Verify port is not blocked by firewall

### "Test database not found"
- The setup script should create it automatically
- Or manually create: `CREATE DATABASE clock_test_db;`

### Tests hang or timeout
- Check database connection
- Increase timeout in vitest.config.ts
- Ensure previous test runs cleaned up properly

### TypeScript errors
- Run `npm run build` to check for compilation errors
- Ensure all dependencies are installed: `npm install`
