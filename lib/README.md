# @clock/shared

Shared utilities library for the clock application frontend and backend.

## Structure

- `utils/passwordHash.ts` - Password hashing utilities (client-side for transport security)
- `utils/monthlyBalance.ts` - Monthly balance calculation logic
- `utils/timeFormat.ts` - Time formatting utilities
- `utils/csvImport.ts` - CSV parsing and timelog import utilities
- `types/` - Shared TypeScript type definitions

## Usage

This library is consumed by both the frontend and backend modules. The password hashing utility has separate implementations for Node.js and browser environments, selected automatically via package.json exports.

### Backend

```typescript
import { hashPasswordForTransport } from '../../lib/utils/passwordHash.node.js';
```

### Frontend

```typescript
import { hashPasswordForTransport } from '../../lib/utils/passwordHash.browser.js';
```

## Development

Build the library:
```bash
npm run build
```

### Testing

Run tests in watch mode (interactive):
```bash
npm test
```

Run tests once (CI/CD):
```bash
npm run test:run
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run tests in watch mode (explicit):
```bash
npm run test:watch
```

### Test Coverage

Coverage reports are generated in the `coverage/` directory when running `npm run test:coverage`. The test suite aims for:
- 80% line coverage
- 80% function coverage
- 80% branch coverage
- 80% statement coverage

### CI/CD Pipeline

The lib package has its own GitHub Actions workflow (`.github/workflows/lib-tests.yml`) that:
1. Runs on every push to `main`, `develop`, or `copilot/**` branches
2. Executes all tests with `npm run test:run`
3. Builds the package with `npm run build`
4. Generates coverage reports with `npm run test:coverage`
5. Uploads coverage to Codecov

The pipeline ensures that the shared library is stable before being consumed by frontend and backend modules.
