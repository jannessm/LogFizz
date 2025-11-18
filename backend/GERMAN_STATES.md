# German States Reference Table

## Overview
The `states` table provides a normalized reference for German federal states (Bundesländer). This table is used by `user_state_entries` to track which state a user was registered in at different points in time.

## Database Schema

### States Table

```sql
CREATE TABLE "states" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "country" character varying NOT NULL,
    "state" character varying NOT NULL,
    "code" character varying NOT NULL UNIQUE
);
```

**Columns:**
- `id` - UUID primary key
- `country` - Country name (e.g., "Germany")
- `state` - Full state name (e.g., "Baden-Württemberg")
- `code` - ISO 3166-2 state code (e.g., "DE-BW")

### User State Entries Table (Updated)

```sql
CREATE TABLE "user_state_entries" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "state_id" uuid NOT NULL REFERENCES "states"("id") ON DELETE RESTRICT,
    "registered_at" timestamptz NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "deleted_at" timestamptz
);
```

**Changes from previous version:**
- ❌ Removed: `state` varchar column
- ✅ Added: `state_id` uuid column with foreign key to `states` table
- 🔒 Foreign key uses `ON DELETE RESTRICT` - cannot delete a state if it's referenced

## German States Data

All 16 German federal states are pre-populated:

| State | German Name | Code |
|-------|------------|------|
| Baden-Württemberg | Baden-Württemberg | DE-BW |
| Bavaria | Bayern | DE-BY |
| Berlin | Berlin | DE-BE |
| Brandenburg | Brandenburg | DE-BB |
| Bremen | Bremen | DE-HB |
| Hamburg | Hamburg | DE-HH |
| Hesse | Hessen | DE-HE |
| Mecklenburg-Vorpommern | Mecklenburg-Vorpommern | DE-MV |
| Lower Saxony | Niedersachsen | DE-NI |
| North Rhine-Westphalia | Nordrhein-Westfalen | DE-NW |
| Rhineland-Palatinate | Rheinland-Pfalz | DE-RP |
| Saarland | Saarland | DE-SL |
| Saxony | Sachsen | DE-SN |
| Saxony-Anhalt | Sachsen-Anhalt | DE-ST |
| Schleswig-Holstein | Schleswig-Holstein | DE-SH |
| Thuringia | Thüringen | DE-TH |

## Entity Relationships

```
State (1) ←──── (many) UserStateEntry
   ↓
   └── Restricts deletion if referenced
```

## Entities

### State Entity

```typescript
@Entity('states')
export class State {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar')
  country!: string;

  @Column('varchar')
  state!: string;

  @Column('varchar', { unique: true })
  code!: string;
}
```

### UserStateEntry Entity (Updated)

```typescript
@Entity('user_state_entries')
export class UserStateEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('uuid')
  state_id!: string;  // ← Changed from varchar 'state'

  @Column('timestamptz')
  registered_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at?: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => State, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'state_id' })
  state?: State;  // ← New relation
}
```

## Services

### StateService

New service for managing states:

```typescript
class StateService {
  getAllStates(): Promise<State[]>
  getStatesByCountry(country: string): Promise<State[]>
  getStateById(id: string): Promise<State | null>
  getStateByCode(code: string): Promise<State | null>
  createState(country: string, state: string, code: string): Promise<State>
}
```

### UserStateEntryService (Updated)

Updated to use `state_id` instead of `state` string:

**Before:**
```typescript
createStateEntry(userId: string, state: string, registeredAt: Date)
```

**After:**
```typescript
createStateEntry(userId: string, stateId: string, registeredAt: Date)
```

All query methods now include `relations: ['state']` to populate the state object.

## Usage Examples

### Creating a State Entry

```typescript
import { StateService } from './services/state.service.js';
import { UserStateEntryService } from './services/user-state-entry.service.js';

const stateService = new StateService();
const entryService = new UserStateEntryService();

// Get Berlin state
const berlin = await stateService.getStateByCode('DE-BE');

// Create entry for user
const entry = await entryService.createStateEntry(
  userId,
  berlin.id,
  new Date()
);

// Entry includes populated state relation
console.log(entry.state?.state); // "Berlin"
console.log(entry.state?.code);  // "DE-BE"
```

### Fetching Entries with State Data

```typescript
// All methods now include state relation
const entries = await entryService.getStateEntriesByUser(userId);

entries.forEach(entry => {
  console.log(`${entry.state?.state} (${entry.state?.code})`);
  // Output: Berlin (DE-BE)
});
```

### Updating State Entry

```typescript
// Change user's state
const bayern = await stateService.getStateByCode('DE-BY');

await entryService.updateStateEntry(userId, entryId, {
  state_id: bayern.id
});
```

## API Integration

Frontend should:
1. Fetch all states once on app load
2. Store states in local state/store
3. Display state names in UI
4. Submit state IDs to backend

Example API endpoint:
```typescript
// GET /api/states
fastify.get('/states', async (request, reply) => {
  const stateService = new StateService();
  const states = await stateService.getAllStates();
  return states;
});

// Response:
[
  {
    "id": "uuid...",
    "country": "Germany",
    "state": "Berlin",
    "code": "DE-BE"
  },
  // ... other states
]
```

## Migration Notes

### Breaking Changes

⚠️ **This is a breaking change** - existing code using string `state` values must be updated to use `state_id` UUIDs.

### Migration Steps

If you have existing data:

1. Create migration to add `state_id` column
2. Create `states` table and populate with data
3. Map existing `state` strings to state IDs
4. Drop old `state` column
5. Update all code to use `state_id`

For fresh installations:
- Migration handles everything automatically
- States are pre-populated on first run

## Benefits of This Approach

✅ **Data Integrity**: Foreign key ensures only valid states are used
✅ **Consistency**: State names are standardized
✅ **Extensibility**: Easy to add more countries/states
✅ **Efficiency**: State data is not duplicated
✅ **Relationships**: Can query which users are in which states
✅ **Future-Proof**: Can add state-specific data (holidays, tax rates, etc.)

## Testing

Tests updated to use state IDs:

```typescript
// Get test state
const berlin = await stateService.getStateByCode('DE-BE');
const testStateId = berlin.id;

// Use in tests
const entry = await service.createStateEntry(
  testUserId,
  testStateId,
  new Date()
);

expect(entry.state_id).toBe(testStateId);
```

## Files Modified

- ✅ `src/entities/State.ts` - NEW
- ✅ `src/entities/UserStateEntry.ts` - Updated to use state_id
- ✅ `src/services/state.service.ts` - NEW
- ✅ `src/services/user-state-entry.service.ts` - Updated methods
- ✅ `src/config/database.ts` - Added State entity
- ✅ `src/migrations/1699700000000-InitialSchema.ts` - Added states table
- ✅ `src/__tests__/user-state-entry.test.ts` - Updated to use state_id
