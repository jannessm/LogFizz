# Redis Session Storage

This application uses Redis to persist user sessions, providing a robust and scalable session management solution.

## Why Redis for Sessions?

- **Persistence**: Sessions survive server restarts
- **Scalability**: Easy to scale horizontally with multiple backend instances
- **Performance**: Fast in-memory storage with optional persistence
- **TTL Support**: Automatic session expiration
- **Production Ready**: Battle-tested in production environments

## Configuration

### Environment Variables

```env
REDIS_HOST=localhost      # Redis server host
REDIS_PORT=6379          # Redis server port (default: 6379)
```

### Session Settings

- **Cookie Name**: `sessionId`
- **Session TTL**: 24 hours
- **Storage Prefix**: `session:`
- **Cookie Security**: 
  - `httpOnly: true` - Prevents XSS attacks
  - `sameSite: 'lax'` - CSRF protection
  - `secure: false` - Set to `true` in production with HTTPS

## Docker Setup

The docker-compose.yml includes a Redis service:

```yaml
redis:
  image: redis:7-alpine
  container_name: clock-redis
  command: redis-server --appendonly yes
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

### Persistence

Redis is configured with AOF (Append-Only File) persistence:
- `--appendonly yes`: Enables AOF persistence
- Data is stored in the `redis_data` Docker volume
- Survives container restarts and rebuilds

## Development vs Production

### Development

Redis is **optional** in development:
- If `REDIS_HOST` is not set, sessions use in-memory storage
- Convenient for quick local development
- Sessions lost on server restart

To use Redis in development:
```bash
# macOS
brew install redis
brew services start redis

# Or use Docker
docker-compose up redis
```

### Production

Redis is **strongly recommended** for production:
- Set `REDIS_HOST` environment variable
- Use persistent storage (Docker volume or disk)
- Consider Redis clustering for high availability
- Monitor Redis memory usage
- Set up regular backups of Redis data

## Session Storage Details

### Session Data Structure

Sessions are stored in Redis with:
- **Key**: `session:<sessionId>`
- **Value**: Serialized session data (including `userId`)
- **TTL**: 24 hours (86400 seconds)

### Session Lifecycle

1. **Login**: Session created with user ID
2. **Requests**: Session validated and extended on each request
3. **Logout**: Session destroyed from Redis
4. **Expiration**: Sessions auto-expire after 24 hours of inactivity

## Monitoring & Management

### Check Redis Connection

```bash
# Connect to Redis CLI
redis-cli

# Check if Redis is running
redis-cli ping
# Expected output: PONG

# List all session keys
redis-cli KEYS "session:*"

# Get session data
redis-cli GET "session:<sessionId>"
```

### View Session Count

```bash
# Count active sessions
redis-cli KEYS "session:*" | wc -l
```

### Clear All Sessions (Development)

```bash
# Delete all sessions
redis-cli KEYS "session:*" | xargs redis-cli DEL
```

## Troubleshooting

### Redis Connection Failed

**Symptom**: Application starts but logs "Failed to connect to Redis"

**Solutions**:
1. Check Redis is running: `redis-cli ping`
2. Verify `REDIS_HOST` and `REDIS_PORT` in `.env`
3. Check firewall rules if Redis is on remote host
4. Check Redis logs: `docker-compose logs redis`

### Sessions Not Persisting

**Symptom**: Users logged out after server restart

**Possible Causes**:
1. Redis not configured (using in-memory storage)
2. Redis container restarted without persistent volume
3. Redis AOF not enabled

**Solution**: Ensure Docker volume is configured and Redis has `--appendonly yes`

### Memory Issues

**Symptom**: Redis running out of memory

**Solutions**:
1. Check memory usage: `redis-cli INFO memory`
2. Adjust Redis maxmemory policy
3. Reduce session TTL
4. Clean up expired sessions: `redis-cli --scan --pattern "session:*" | xargs redis-cli DEL`

## Migration from In-Memory Sessions

If you're migrating from in-memory sessions:

1. **Install Redis dependencies**: Already in `package.json`
2. **Start Redis**: Docker or local installation
3. **Set environment variables**: Add `REDIS_HOST` to `.env`
4. **Restart backend**: Sessions will now persist in Redis
5. **Existing sessions**: Users will need to re-login (old sessions lost)

## Security Considerations

- **Network Security**: Use Redis authentication in production (`requirepass`)
- **Encryption**: Use TLS for Redis connections in production
- **Firewall**: Restrict Redis port access to backend servers only
- **Data Sensitivity**: Sessions contain user IDs - protect Redis access
- **Regular Updates**: Keep Redis updated for security patches

## References

- [Redis Documentation](https://redis.io/docs/)
- [Redis Persistence](https://redis.io/docs/management/persistence/)
- [@fastify/session-redis-store](https://github.com/fastify/session-redis-store)
- [ioredis Client](https://github.com/redis/ioredis)
