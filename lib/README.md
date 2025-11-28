# @clock/shared

Shared utilities library for the clock application frontend and backend.

## Structure

- `utils/passwordHash.ts` - Password hashing utilities (client-side for transport security)
- `utils/monthlyBalance.ts` - Monthly balance calculation logic
- `utils/timeFormat.ts` - Time formatting utilities

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

Run tests:
```bash
npm test
```
