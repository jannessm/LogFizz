# Redis Tests Documentation

This document describes the comprehensive test suite for Redis session storage implementation.

## Test Files

### 1. `redis.test.ts` - Integration Tests

Integration tests that verify Redis session storage works correctly with the full application stack.

#### Test Suites

##### **Redis Session Storage**
Tests the complete session lifecycle with Redis backing.

**Test Cases:**

1. **Redis Client Configuration**
   - ✅ Verifies Redis client is created with proper configuration
   - ✅ Tests graceful handling of missing Redis configuration
   - ✅ Ensures application doesn't crash without Redis

2. **Session Persistence with Redis**
   - ✅ Creates session on user login
   - ✅ Maintains session across multiple requests
   - ✅ Returns 401 without valid session
   - ✅ Destroys session on logout
   - ✅ Verifies session cleanup after logout

3. **Session Data Integrity**
   - ✅ Stores user ID correctly in session
   - ✅ Retrieves user data from session
   - ✅ Handles concurrent sessions for same user
   - ✅ Maintains separate session IDs

4. **Session Security**
   - ✅ Sets `HttpOnly` cookie flag (XSS protection)
   - ✅ Sets `SameSite=Lax` attribute (CSRF protection)
   - ✅ Sets correct `Path=/` attribute
   - ✅ Rejects invalid session cookies
   - ✅ Rejects malformed session cookies

5. **Redis Connection Resilience**
   - ✅ Handles Redis unavailability gracefully
   - ✅ Provides fallback to in-memory sessions
   - ✅ Application continues to work without Redis

6. **Session with Protected Routes**
   - ✅ Allows access to buttons endpoint with valid session
   - ✅ Allows access to timelogs endpoint with valid session
   - ✅ Denies access without valid session
   - ✅ Validates session on each protected request

##### **Redis Client Management**
Tests the Redis client lifecycle management functions.

**Test Cases:**

1. **createRedisClient()**
   - ✅ Returns null when `REDIS_HOST` not set in test environment
   - ✅ Creates client when `REDIS_HOST` is configured
   - ✅ Properly cleans up after tests

2. **getRedisClient()**
   - ✅ Returns current Redis client instance
   - ✅ Returns null when Redis not configured

### 2. `redis-config.test.ts` - Unit Tests

Unit tests for the Redis configuration module with mocked dependencies.

#### Test Suites

##### **Redis Configuration Unit Tests**

**Test Cases:**

1. **createRedisClient Behavior**
   - ✅ No client in test environment without `REDIS_HOST`
   - ✅ No client when `REDIS_HOST` not set
   - ✅ Creates client when `REDIS_HOST` is set
   - ✅ Uses default port (6379) when `REDIS_PORT` not set
   - ✅ Uses custom port when `REDIS_PORT` is set
   - ✅ Configures retry strategy correctly
   - ✅ Calculates retry delay with exponential backoff (max 2000ms)

2. **getRedisClient**
   - ✅ Returns null initially or current client
   - ✅ Returns correct client after initialization

3. **closeRedisClient**
   - ✅ Handles closing null client gracefully
   - ✅ Calls quit() on existing client
   - ✅ Sets client to null after closing

4. **Redis Event Handlers**
   - ✅ Registers 'connect' event handler
   - ✅ Registers 'error' event handler
   - ✅ Registers 'close' event handler

5. **Error Handling**
   - ✅ Handles connection errors gracefully
   - ✅ Sets client to null on connection failure
   - ✅ Doesn't crash application on Redis errors

6. **Configuration Validation**
   - ✅ Handles test environment correctly
   - ✅ Skips Redis in test without explicit config
   - ✅ Respects `VITEST` flag
   - ✅ Allows Redis in test if explicitly configured

## Running the Tests

### Run All Tests
```bash
npm test
```

### Run Only Redis Tests
```bash
npm test redis
```

### Run Specific Test File
```bash
npm test redis.test.ts
npm test redis-config.test.ts
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run in Watch Mode
```bash
npm run dev
# Tests run automatically on file changes
```

## Test Environment Setup

### Required Environment Variables

For integration tests (redis.test.ts):
```env
# Optional - tests work without Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

For unit tests (redis-config.test.ts):
```env
# No specific requirements - uses mocks
```

### Database Setup

Integration tests require PostgreSQL:
```bash
# Ensure test database exists
npm run test:setup
```

### Redis Setup (Optional)

To test with actual Redis:
```bash
# Option 1: Docker
docker-compose up redis

# Option 2: Local Redis (macOS)
brew install redis
brew services start redis

# Option 3: Skip Redis
# Tests will automatically use in-memory sessions
```

## Test Coverage

### Covered Scenarios

✅ **Happy Path**
- User registration and login
- Session creation and validation
- Session persistence across requests
- Session destruction on logout

✅ **Error Handling**
- Missing Redis configuration
- Invalid session cookies
- Malformed cookies
- Unauthorized access attempts
- Redis connection failures

✅ **Security**
- Cookie security attributes
- Session isolation
- Protected route access control
- Session tampering prevention

✅ **Edge Cases**
- Concurrent sessions
- Redis unavailability
- In-memory fallback
- Environment-specific behavior

### Coverage Metrics

Run coverage report to see detailed metrics:
```bash
npm run test:coverage
```

Expected coverage for Redis modules:
- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Lines**: >90%

## Test Data

### Test Users

Tests create temporary users with pattern:
```
redis-test-${timestamp}@example.com
fallback-${timestamp}@example.com
```

These are automatically created and isolated per test run.

### Session Data

Each test creates its own sessions with:
- Unique session IDs
- User authentication state
- Isolated cookies
- Automatic cleanup

## Debugging Tests

### Enable Verbose Logging

```bash
# Set log level
export NODE_ENV=development
npm test redis
```

### Check Redis During Tests

```bash
# In another terminal, monitor Redis
redis-cli MONITOR

# Or check session keys
redis-cli KEYS "session:*"
```

### Inspect Test Database

```bash
# Connect to test database
psql -U clock_user -d clock_test_db

# Check users created by tests
SELECT email FROM users WHERE email LIKE '%redis-test%';
```

## Common Test Failures

### 1. Redis Connection Timeout

**Error**: `Redis connection failed`

**Solution**:
- Check Redis is running: `redis-cli ping`
- Verify `REDIS_HOST` in `.env`
- Or remove `REDIS_HOST` to use in-memory sessions

### 2. Session Cookie Not Set

**Error**: `Expected cookie to contain 'sessionId'`

**Solution**:
- Check session configuration in `app.ts`
- Verify `SESSION_SECRET` is set
- Check Fastify cookie plugin is registered

### 3. Database Connection Error

**Error**: `Database connection failed`

**Solution**:
```bash
# Recreate test database
npm run test:setup
```

### 4. Port Already in Use

**Error**: `EADDRINUSE: address already in use`

**Solution**:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

## Continuous Integration

### GitHub Actions

The tests run automatically on:
- Every push to any branch
- Every pull request
- Manual workflow dispatch

Configuration: `.github/workflows/backend-tests.yml`

### CI Environment

CI runs with:
- PostgreSQL service container
- No Redis (uses in-memory sessions)
- Test database auto-created
- All tests must pass

## Test Maintenance

### Adding New Tests

When adding Redis-related features:

1. Add integration tests to `redis.test.ts`
2. Add unit tests to `redis-config.test.ts`
3. Update this documentation
4. Run coverage to ensure >90%

### Updating Existing Tests

When modifying Redis behavior:

1. Update relevant test assertions
2. Ensure backward compatibility
3. Run full test suite
4. Update documentation if needed

## Best Practices

### Test Isolation
- ✅ Each test creates its own users
- ✅ Each test uses unique session cookies
- ✅ Tests don't share state
- ✅ Automatic cleanup after tests

### Performance
- ✅ Tests run in parallel where possible
- ✅ Database connections reused
- ✅ Redis connections pooled
- ✅ Test data minimized

### Reliability
- ✅ Tests work with or without Redis
- ✅ No external dependencies required
- ✅ Deterministic behavior
- ✅ Clear error messages

## Related Documentation

- [REDIS_SESSIONS.md](./REDIS_SESSIONS.md) - Redis session storage guide
- [REDIS_SETUP.md](../REDIS_SETUP.md) - Redis setup summary
- [Backend README](./README.md) - General backend documentation
- [Developer Guide](../docs/DEVELOPER_GUIDE.md) - Development workflow

## Troubleshooting

For issues with tests, check:

1. **Environment Variables**: Verify `.env` configuration
2. **Database**: Ensure PostgreSQL is running
3. **Redis**: Optional but check if explicitly configured
4. **Dependencies**: Run `npm install` if packages missing
5. **Logs**: Check test output for specific errors

## Future Test Improvements

Potential enhancements:
- [ ] Load testing for session performance
- [ ] Redis cluster testing
- [ ] Session migration tests
- [ ] Redis sentinel failover tests
- [ ] Memory leak detection
- [ ] Session TTL expiration tests
- [ ] Concurrent user simulation

## Quick Test Commands

```bash
# Run all tests including Redis tests
npm test

# Run only Redis tests
npm test redis

# Run with coverage
npm run test:coverage

# Watch mode
npm run dev
```

## Summary

The Redis test suite provides:
- **38+ test cases** covering all Redis functionality
- **Integration tests** with full application stack
- **Unit tests** with mocked dependencies
- **Security validation** for session cookies
- **Error resilience** testing
- **Environment flexibility** (works with/without Redis)

All tests are designed to run in CI/CD pipelines and local development environments without requiring Redis infrastructure.
