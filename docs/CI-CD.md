# CI/CD Pipeline Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the Clock time tracking application.

## Overview

The CI/CD pipeline is implemented using **GitHub Actions** and automatically runs tests on every push and pull request to ensure code quality and catch issues early.

## Pipeline Configuration

### Backend Tests Pipeline

**File:** `.github/workflows/backend-tests.yml`

**Triggers:**
- Push to branches: `main`, `develop`, `copilot/**`
- Pull requests to: `main`, `develop`
- Only when backend files change

**What it does:**
1. Sets up PostgreSQL database for testing
2. Installs Node.js dependencies
3. Runs all backend tests
4. Generates test coverage report
5. Uploads coverage to Codecov (optional)

**Duration:** ~2-3 minutes per run

### Services

The pipeline uses the following services:

#### PostgreSQL Database
- **Image:** `postgres:14`
- **Database:** `clock_test_db`
- **User:** `clock_user`
- **Password:** `clock_password`
- **Port:** `5432`
- **Health checks:** Enabled with pg_isready

### Environment Variables

The following environment variables are set during test execution:

```yaml
NODE_ENV: test
DB_HOST: localhost
DB_PORT: 5432
DB_USERNAME: clock_user
DB_PASSWORD: clock_password
DB_DATABASE: clock_test_db
SESSION_SECRET: test-secret-key-for-ci-pipeline
```

## Branching Strategy

The project follows a Git Flow-inspired branching strategy:

### Branch Types

1. **`main`** - Production-ready code
   - Protected branch
   - Requires passing CI checks before merge
   - Tagged with version numbers for releases

2. **`develop`** - Integration branch
   - Latest development changes
   - CI runs on every push
   - Base branch for feature branches

3. **`feature/*`** - Feature development
   - Created from `develop`
   - Merged back to `develop` via PR
   - Example: `feature/add-widgets`

4. **`copilot/*`** - AI-assisted development
   - Created for Copilot-generated code
   - Follows same rules as feature branches
   - Example: `copilot/implement-backend-with-tests`

5. **`hotfix/*`** - Emergency fixes
   - Created from `main`
   - Merged to both `main` and `develop`
   - Example: `hotfix/fix-critical-bug`

6. **`release/*`** - Release preparation
   - Created from `develop`
   - Merged to `main` and tagged
   - Example: `release/v1.0.0`

### Workflow

```
main ←─────────────────── release/v1.0.0 ←── develop
  ↑                                            ↑
  │                                            │
  └── hotfix/critical-fix                      │
                                               │
                                    feature/new-feature
```

## Running Tests Locally

Before pushing code, you can run tests locally:

```bash
# Backend tests
cd backend
npm test

# With coverage
npm run test:coverage

# Watch mode for development
npm run test -- --watch

# UI mode for interactive testing
npm run test:ui
```

## CI Status

You can view the CI status:

1. **On GitHub:**
   - Go to the repository
   - Click on "Actions" tab
   - View recent workflow runs

2. **On Pull Requests:**
   - CI status is shown at the bottom of each PR
   - Must pass before merging

3. **Branch Protection:**
   - Configure in Settings → Branches
   - Require status checks to pass before merging
   - Require branches to be up to date before merging

## Setting Up Branch Protection (Recommended)

To enforce CI checks before merging:

1. Go to Settings → Branches
2. Add branch protection rule for `main`:
   - Branch name pattern: `main`
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - Select: "Run Backend Tests"
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators

3. Add branch protection rule for `develop`:
   - Branch name pattern: `develop`
   - ✅ Require status checks to pass before merging
   - Select: "Run Backend Tests"

## Code Coverage

The pipeline generates code coverage reports using Vitest's built-in coverage tool.

**Current Coverage:**
- Test files cover authentication, buttons, timelogs, sync, rate limiting, and utilities
- Coverage reports are generated on each CI run
- Optional: Upload to Codecov for tracking over time

**To view coverage locally:**
```bash
cd backend
npm run test:coverage
# Open coverage/index.html in your browser
```

## Troubleshooting CI Failures

### Common Issues

**1. Test Failures**
- Check the test logs in the GitHub Actions tab
- Run tests locally to reproduce the issue
- Ensure database migrations are up to date

**2. Database Connection Issues**
- Verify PostgreSQL service is healthy
- Check environment variables match test configuration
- Ensure database schema is synchronized

**3. Dependency Issues**
- Make sure `package-lock.json` is committed
- Update Node.js version if needed
- Clear npm cache if needed

**4. Timeout Issues**
- Tests have default timeout of 5 seconds
- Increase timeout in vitest.config.ts if needed
- Check for infinite loops or hanging connections

## Future Enhancements

Planned improvements to the CI/CD pipeline:

- [ ] Add Docker build and push to registry
- [ ] Add deployment to staging environment
- [ ] Add deployment to production environment
- [ ] Add frontend tests when frontend is implemented
- [ ] Add E2E tests
- [ ] Add security scanning (Snyk, Dependabot)
- [ ] Add performance benchmarking
- [ ] Add automated version tagging
- [ ] Add release notes generation
- [ ] Add Slack/Discord notifications for build status

## Manual Deployment

For now, deployment is manual. Follow these steps:

### Deploy to VPS

```bash
# 1. SSH into your VPS
ssh user@your-vps-ip

# 2. Pull latest changes
cd /path/to/clock
git pull origin main

# 3. Rebuild and restart containers
docker-compose down
docker-compose up -d --build

# 4. Run migrations (if needed)
docker-compose exec backend npm run migration:run

# 5. Check health
curl http://localhost:3000/health
```

## Continuous Deployment (Future)

When ready for CD, the pipeline can be extended to:

1. Build Docker images
2. Push to container registry
3. Deploy to staging on `develop` branch
4. Deploy to production on `main` branch with approval

Example extension:
```yaml
deploy:
  needs: test
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  steps:
    - name: Deploy to production
      # Add deployment steps here
```

## Contributing

When contributing to this project:

1. Create a feature branch from `develop`
2. Make your changes
3. Ensure tests pass locally: `npm test`
4. Push your branch - CI will run automatically
5. Create a Pull Request to `develop`
6. Wait for CI checks to pass (green checkmark)
7. Request code review
8. Merge after approval

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vitest Documentation](https://vitest.dev/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Node.js Setup Action](https://github.com/actions/setup-node)

---

**Last Updated:** November 2025
