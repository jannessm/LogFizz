# User State Entries Feature

## Overview
Added a new table `user_state_entries` with a one-to-many relationship from users to state entries. Each entry tracks when a user is registered for a specific state at a given timestamp.

## Database Schema

### Table: `user_state_entries`
```sql
CREATE TABLE "user_state_entries" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "state" varchar NOT NULL,
  "registered_at" timestamptz NOT NULL,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
```

### Indexes
- `IDX_user_state_entries_user_id` - for efficient user queries
- `IDX_user_state_entries_registered_at` - for time-based queries
- `IDX_user_state_entries_deleted_at` - for soft-delete queries
- `IDX_user_state_entries_updated_at` - for sync functionality

## Entity: UserStateEntry

Located: `src/entities/UserStateEntry.ts`

**Fields:**
- `id` (uuid) - Primary key
- `user_id` (uuid) - Foreign key to users table
- `state` (string) - The state value
- `registered_at` (Date) - When the user was registered for this state
- `notes` (string, optional) - Additional notes about the state entry
- `created_at` (Date) - Record creation timestamp
- `updated_at` (Date) - Record last update timestamp
- `deleted_at` (Date, optional) - Soft delete timestamp

**Relationships:**
- `user` (ManyToOne) - Belongs to a User

## Service: UserStateEntryService

Located: `src/services/user-state-entry.service.ts`

### Methods

#### Basic CRUD
- `createStateEntry(userId, state, registeredAt, notes?)` - Create a new entry
- `getStateEntriesByUser(userId)` - Get all entries for a user (active only)
- `getStateEntryById(userId, entryId)` - Get a single entry
- `updateStateEntry(userId, entryId, updates)` - Update an entry
- `deleteStateEntry(userId, entryId)` - Soft delete an entry

#### Query Methods
- `getMostRecentStateEntry(userId)` - Get the latest entry for a user
- `getStateEntriesInRange(userId, startDate, endDate)` - Get entries within a date range

#### Sync Methods (Offline-First)
- `getChangedStateEntriesSince(userId, since)` - Get all entries (including deleted) changed since timestamp
- `pushStateEntryChanges(userId, changes)` - Bulk create/update with conflict detection
  - Returns: `{ saved: UserStateEntry[], conflicts: Array<{ clientVersion, serverVersion }> }`

## Usage Examples

### Create a State Entry
```typescript
import { UserStateEntryService } from './services/user-state-entry.service.js';

const service = new UserStateEntryService();
const entry = await service.createStateEntry(
  userId,
  'active',
  new Date(),
  'User activated their account'
);
```

### Get User's State History
```typescript
const entries = await service.getStateEntriesByUser(userId);
// Returns entries ordered by registered_at DESC
```

### Get Most Recent State
```typescript
const currentState = await service.getMostRecentStateEntry(userId);
```

### Query by Date Range
```typescript
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const now = new Date();
const recentEntries = await service.getStateEntriesInRange(userId, lastWeek, now);
```

### Offline-First Sync
```typescript
// Get changes since last sync
const lastSync = new Date('2024-01-01');
const changes = await service.getChangedStateEntriesSince(userId, lastSync);

// Push client changes
const result = await service.pushStateEntryChanges(userId, [
  { id: 'uuid', state: 'inactive', updated_at: new Date() }
]);

if (result.conflicts.length > 0) {
  // Handle conflicts - server has newer data
  console.log('Conflicts:', result.conflicts);
}
```

## Testing

Test file: `src/__tests__/user-state-entry.test.ts`

Tests cover:
- ✅ Creating state entries
- ✅ Retrieving entries by user
- ✅ Getting single entry by ID
- ✅ Updating entries
- ✅ Soft deleting entries
- ✅ Getting most recent entry
- ✅ Querying by date range
- ✅ Sync with conflict detection

Run tests:
```bash
npm test user-state-entry.test.ts
```

## Integration

The entity is registered in:
- ✅ `src/config/database.ts` - Added to entities array
- ✅ `src/entities/User.ts` - Added `state_entries` OneToMany relationship
- ✅ `src/migrations/1699700000000-InitialSchema.ts` - Table creation and indexes

## Notes

- Supports soft deletes (deleted_at field)
- Includes conflict detection for offline-first sync
- Timestamps use `timestamptz` for timezone awareness
- Cascading delete: When a user is deleted, all their state entries are deleted
- Ordered by `registered_at DESC` by default for chronological history
