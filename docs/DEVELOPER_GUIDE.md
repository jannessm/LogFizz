# Developer Quick Start Guide

## Setting Up Your Development Environment

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Git
- Docker (optional, for containerized development)

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jannessm/clock.git
   cd clock
   ```

2. **Set up the backend:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Set up PostgreSQL:**
   ```bash
   # Using Docker (recommended)
   docker run -d \
     --name clock-postgres \
     -e POSTGRES_USER=clock_user \
     -e POSTGRES_PASSWORD=clock_password \
     -e POSTGRES_DB=clock_db \
     -p 5432:5432 \
     postgres:14

   # Or create manually
   psql -U postgres
   CREATE DATABASE clock_db;
   CREATE USER clock_user WITH ENCRYPTED PASSWORD 'clock_password';
   GRANT ALL PRIVILEGES ON DATABASE clock_db TO clock_user;
   ```

4. **Run migrations:**
   ```bash
   npm run migration:run
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. **Access the application:**
   - API: http://localhost:3000
   - Swagger UI: http://localhost:3000/docs
   - Health Check: http://localhost:3000/health

## Development Workflow

### Creating a New Feature

1. **Pull latest changes:**
   ```bash
   git checkout develop
   git pull origin develop
   ```

2. **Create feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes and test:**
   ```bash
   # Run tests
   npm test

   # Run tests in watch mode while developing
   npm test -- --watch

   # Check test coverage
   npm run test:coverage
   ```

4. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create PR:**
   ```bash
   git push origin feature/your-feature-name
   # Go to GitHub and create a Pull Request to develop
   ```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```bash
git commit -m "feat: add password reset functionality"
git commit -m "fix: resolve timer sync issue"
git commit -m "test: add tests for button API"
git commit -m "docs: update API documentation"
```

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run specific test file
npm test src/__tests__/auth.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode (re-runs on file changes)
npm test -- --watch

# Run with UI (interactive browser-based test runner)
npm run test:ui
```

### Test Structure

Tests are located in `backend/src/__tests__/`:
- `auth.test.ts` - Authentication endpoints
- `button.test.ts` - Button management
- `timelog.test.ts` - Time logging
- `sync.test.ts` - Offline-first sync
- `password.test.ts` - Password utilities
- `breaks.test.ts` - Break calculation
- `rateLimit.test.ts` - Rate limiting

## CI/CD Pipeline

### Automatic Testing

Tests run automatically on:
- Push to `main`, `develop`, or `copilot/**` branches
- Pull requests to `main` or `develop`

View test results:
- GitHub Actions tab in the repository
- PR status checks

### Branch Protection

Before merging to `main`:
- ✅ All tests must pass
- ✅ Code review required
- ✅ Branch must be up to date

## Common Tasks

### Adding a New Endpoint

1. **Create/update entity** (if needed):
   ```typescript
   // backend/src/entities/YourEntity.ts
   ```

2. **Create/update service:**
   ```typescript
   // backend/src/services/your.service.ts
   ```

3. **Create/update routes:**
   ```typescript
   // backend/src/routes/your.routes.ts
   ```

4. **Add tests:**
   ```typescript
   // backend/src/__tests__/your.test.ts
   ```

5. **Update Swagger documentation** (automatically generated from TypeBox schemas)

### Database Migrations

```bash
# Generate a new migration
npm run migration:generate -- YourMigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

### Debugging

**Development Mode:**
- Logs are output to console
- Fastify logger is enabled
- Database queries are logged

**Test Mode:**
- Logs are disabled by default
- Set `logger: true` in `app.ts` temporarily if needed

**Using Debugger:**
```bash
# With Node.js inspector
node --inspect node_modules/.bin/tsx src/index.ts

# In VS Code, add to launch.json:
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev"],
  "cwd": "${workspaceFolder}/backend",
  "console": "integratedTerminal"
}
```

## Docker Development

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

### Running tests in Docker

```bash
docker-compose exec backend npm test
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Or if using local PostgreSQL
pg_isready -h localhost -p 5432

# Test connection
psql -h localhost -U clock_user -d clock_db
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)
```

### Tests Failing Locally

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Ensure test database is clean
# Tests use separate database and clean up automatically
```

### Migration Issues

```bash
# Drop database and recreate (development only!)
psql -U postgres
DROP DATABASE clock_db;
CREATE DATABASE clock_db;
GRANT ALL PRIVILEGES ON DATABASE clock_db TO clock_user;
\q

# Run migrations again
npm run migration:run
```

## Resources

- [Project Documentation](../README.md)
- [CI/CD Pipeline](./CI-CD.md)
- [Framework Decisions](./frameworks.md)
- [Backend README](../backend/README.md)
- [Implementation Summary](../IMPLEMENTATION.md)
- [Fastify Documentation](https://fastify.dev/)
- [TypeORM Documentation](https://typeorm.io/)
- [Vitest Documentation](https://vitest.dev/)

## Getting Help

- Check existing issues on GitHub
- Review the documentation
- Ask in team discussions
- Create a new issue if needed

---

Happy coding! 🚀
