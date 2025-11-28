# Shared Library Refactoring Summary

## Overview
This refactoring extracted shared functionality from frontend and backend into a common `./lib` directory to eliminate code duplication and ensure consistency.

## Structure

```
lib/
├── package.json           # Shared library package config
├── tsconfig.json          # TypeScript configuration
├── README.md             # Library documentation
├── .gitignore
└── utils/
    ├── passwordHash.browser.ts  # Browser-compatible password hashing
    ├── passwordHash.node.ts     # Node.js password hashing
    ├── monthlyBalance.ts        # Monthly balance calculation logic
    └── timeFormat.ts            # Time formatting utilities
```

## Shared Utilities

### 1. Password Hashing (`utils/passwordHash.ts`)
- **Purpose**: Client-side password hashing for transport security
- **Implementations**:
  - `passwordHash.browser.ts` - Uses Web Crypto API for browsers
  - `passwordHash.node.ts` - Uses Node.js crypto module
- **Function**: `hashPasswordForTransport(password: string, email: string): string | Promise<string>`
- **Used by**: Authentication flows in both frontend and backend tests/scripts

### 2. Monthly Balance Calculations (`utils/monthlyBalance.ts`)
- **Purpose**: Calculate worked minutes, due minutes, and balance tracking
- **Functions**:
  - `calculateWorkedMinutes(timeLogs, rawData?)` - Calculate total worked time from logs
  - `calculateDueMinutes(target, year, month, holidays)` - Calculate expected work time
  - `getEarliestAffectedMonth(timeLogs)` - Find earliest month to recalculate
- **Used by**: Backend monthly balance service, potentially frontend for previews

### 3. Time Formatting (`utils/timeFormat.ts`)
- **Purpose**: Consistent time/duration formatting across the application
- **Functions**:
  - `formatMinutes(minutes)` - Format with sign (e.g., "+2h 30m")
  - `formatMinutesCompact(minutes)` - Compact format (e.g., "2h 30m")
  - `formatHours(minutes)` - Decimal hours (e.g., "2.5h")
  - `formatTime(seconds, includeSeconds?)` - HH:MM:SS or HH:MM format
  - `getBalanceColor(balanceMinutes)` - Tailwind color class for balance display
- **Used by**: Frontend components (History, TimerButton, MonthlyBalance)

## Configuration Changes

### Backend (`backend/tsconfig.json`)
```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@clock/shared/*": ["../lib/utils/*"]
    }
  },
  "include": ["src/**/*", "../lib/**/*"]
}
```

### Frontend (`frontend/tsconfig.app.json`)
```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@clock/shared/*": ["../lib/utils/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.js", "src/**/*.svelte", "../lib/**/*"]
}
```

### Frontend Vite (`frontend/vite.config.ts`)
```typescript
{
  resolve: {
    alias: {
      '@clock/shared': path.resolve(__dirname, '../lib/utils')
    }
  }
}
```

## Import Changes

### Backend Files Updated
- `backend/src/services/monthly-balance.service.ts`
- `backend/src/scripts/seed.ts`
- `backend/src/__tests__/clientPasswordHash.test.ts`
- `backend/src/__tests__/auth.test.ts`
- `backend/src/__tests__/rateLimit.test.ts`

### Frontend Files Updated
- `frontend/src/services/api.ts`
- `frontend/src/components/History/MonthlyBalance.svelte`
- `frontend/src/components/History/HistoryLogs.svelte`
- `frontend/src/components/TimerButton.svelte`
- `frontend/src/test/passwordHash.test.ts`

## Benefits

1. **Code Reusability**: Shared logic is defined once and used by both frontend and backend
2. **Consistency**: Same calculations and formatting across the entire application
3. **Maintainability**: Updates to shared logic only need to be made in one place
4. **Type Safety**: TypeScript types are shared, ensuring API compatibility
5. **Testability**: Shared utilities can be tested independently

## Migration Notes

- The library uses ES modules (`"type": "module"`)
- Browser and Node.js versions of password hashing are automatically selected via package.json exports
- TypeScript path aliases (`@clock/shared/*`) make imports cleaner and more portable
- The lib directory should be built alongside backend/frontend when deploying

## Next Steps

1. Run `npm install` in the lib directory
2. Run tests in both backend and frontend to verify the refactoring
3. Consider adding unit tests specifically for the shared utilities
4. Document any additional shared functionality that could be extracted in the future
