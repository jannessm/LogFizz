# Date & Time Handling

This document describes how dates and times are represented, stored, transmitted, and processed throughout the TapShift codebase — and flags known inconsistencies.

---

## 1. Shared dayjs Configuration (`lib/utils/dayjs.ts`)

All three packages (lib, backend, frontend) import dayjs from the same shared module:

```
lib/utils/dayjs.ts
```

### Plugins loaded

| Plugin | Purpose |
|---|---|
| `utc` | Parse/create dates in UTC |
| `timezone` | Convert between timezones |
| `isSameOrAfter` / `isSameOrBefore` | Inclusive date comparisons |
| `weekOfYear` | ISO week number |
| `localizedFormat` | Locale-aware tokens (`L`, `LT`, `LL`, etc.) |
| `customParseFormat` | Parse non-ISO date strings (CSV import) |

### Key settings

- **Default timezone** is set to `UTC` via `dayjs.tz.setDefault('UTC')`.
- `userTimezone` is exported (resolved via `Intl.DateTimeFormat`) for display purposes.
- Locales loaded: `de`, `en`, `en-gb`.

---

## 2. Type System – Strings vs. Date Objects

The shared `lib/types/index.ts` defines **two parallel type families** for every entity:

| Layer | Type suffix | Date fields are | Example |
|---|---|---|---|
| **API / Frontend** | (none) | `string` (ISO 8601) | `Timer.created_at: string` |
| **Backend / DB** | `Entity` | `Date` | `TimerEntity.created_at: Date` |

This is enforced via `Omit` + re-declaration:

```ts
// lib/types/index.ts
export interface TimerEntity extends Omit<Timer, 'created_at' | 'updated_at' | 'deleted_at'> {
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}
```

### Conversion boundary

- **Backend → Frontend (sync GET):** Entity `Date` objects are serialized via `.toISOString()` in the route handlers before sending JSON.
- **Frontend → Backend (sync POST):** ISO strings from the client are converted to `Date` via `dayjs(value).toDate()` in the route handlers before passing to services/TypeORM.

---

## 3. Database Column Types (PostgreSQL)

| Column type used | Where | Stores TZ info? |
|---|---|---|
| `timestamptz` | Almost everywhere (`created_at`, `updated_at`, `deleted_at`, `start_timestamp`, `end_timestamp`, `starting_from`, `ending_at`, subscription dates, tokens, etc.) | ✅ Yes |
| `timestamp` (without tz) | `HolidayMetadata.last_updated` | ❌ No |
| `date` | `Holiday.date` | ❌ No (date-only) |
| `varchar` | `Balance.date` (stores `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` strings) | N/A (plain string) |

TypeORM auto-generates `created_at` / `updated_at` via `@CreateDateColumn` / `@UpdateDateColumn`.

---

## 4. Date Formats Used

### Internal / storage formats

| Format | Where used | Example |
|---|---|---|
| ISO 8601 with `Z` suffix | All API communication, `updated_at` / `created_at` strings, sync cursors | `2025-11-01T10:00:00.000Z` |
| `YYYY-MM-DD` | Balance daily date, holiday dates, timelog day indexing | `2025-11-15` |
| `YYYY-MM` | Balance monthly date | `2025-11` |
| `YYYY` | Balance yearly date | `2025` |

### Display formats (frontend, locale-aware)

Handled by `frontend/src/lib/dateFormatting.ts` using dayjs localized format tokens:

| Function | Token | Example (en-US) | Example (de-DE) |
|---|---|---|---|
| `formatDate` | `L` | `01/15/2025` | `15.01.2025` |
| `formatDateTime` | `L LT` | `01/15/2025 3:30 PM` | `15.01.2025 15:30` |
| `formatTime` | `LT` | `3:30 PM` | `15:30` |
| `formatFullDate` | `dddd, LL` | `Wednesday, January 15, 2025` | `Mittwoch, 15. Januar 2025` |
| `formatMonthYear` | `MMMM YYYY` | `January 2025` | `Januar 2025` |
| `formatShortDate` | `MMM D` | `Jan 15` | `15. Jan` |

### CSV import formats (`lib/utils/csvImport.ts`)

Accepts multiple date-time patterns for parsing:

```
YYYY-MM-DD HH:mm:ss | DD.MM.YYYY HH:mm:ss | DD/MM/YYYY HH:mm:ss
YYYY-MM-DD HH:mm    | DD.MM.YYYY HH:mm    | DD/MM/YYYY HH:mm
MM/DD/YYYY HH:mm:ss | MM/DD/YYYY HH:mm
YYYY-MM-DDTHH:mm:ss | YYYY-MM-DDTHH:mm
```

---

## 5. Duration & Time Formatting (`lib/utils/timeFormat.ts`)

Durations are always stored as **integer minutes** (or seconds for display timers). Formatting utilities:

| Function | Input | Output |
|---|---|---|
| `formatMinutes(n)` | minutes (signed) | `+2h 30m` / `-1h 30m` |
| `formatMinutesCompact(n)` | minutes (unsigned) | `2h 30m` / `30m` / `1h` |
| `formatMinutesHHMM(n)` | minutes | `02:30` |
| `formatHours(n)` | minutes | `2.5h` |
| `formatTime(s)` | seconds | `01:01:01` / `01:01` |

---

## 6. Timezone Handling Philosophy

From `docs/balances.md`:

> Timezones should not be considered for calculations. Work done at 8:00am in Berlin is treated the same as 8:00am in New York. All timestamps are stored in UTC, displayed in user's local timezone. For calculation purposes, ignore timezone offset — treat as if local.

In practice:

- **Storage:** All `timestamptz` fields store UTC.
- **TimeLogs** carry a `timezone` field (e.g., `Europe/Berlin`) recording where the work was done.
- **Balance calculation** uses `getEffectiveRange()` which clips a timelog to day boundaries in the **timelog's own timezone**, so a log from 22:00–02:00 Berlin time correctly splits across two Berlin dates.
- **Frontend display** uses `userTimezone` (from `Intl.DateTimeFormat`) or the timelog's `timezone` field for rendering.

---

## 7. Sync Timestamps & Cursor Mechanism

The offline-first sync protocol uses `updated_at` comparisons:

1. **GET `/sync?since=<ISO>`** — server returns all records where `updated_at > since` OR `created_at > since`.
2. **POST `/sync`** — client sends records; server compares `updated_at` for conflict detection (last-write-wins).
3. **Cursor** — after each sync the server returns `cursor = new Date().toISOString()` (current server time). The client stores this per data type (`timers`, `timelogs`, `targets`, `balances`) and sends it as `since` on the next pull.
4. **Initial sync** — cursor defaults to `new Date(0).toISOString()` (epoch) to pull all data.

---

## 8. Date Construction Patterns

The codebase uses **multiple patterns** to create dates, which is a source of inconsistency:

| Pattern | Where used | Notes |
|---|---|---|
| `dayjs()` | lib, frontend stores, backend balance/timer services | UTC by default (per shared config) |
| `dayjs.utc(value)` | lib balance calculations | Explicitly UTC |
| `dayjs.tz(value, tz)` | frontend timeline, balance calculations | Timezone-aware |
| `dayjs(value).toDate()` | backend route handlers (deserializing client input) | Converts to native `Date` for TypeORM |
| `new Date()` | backend cleanup, statistics, holiday crawler, frontend sync, live-balance | Native JS Date (local timezone of server/client!) |
| `new Date(value)` | backend timelog service, user-settings service | Parsing ISO strings into Date |
| `new Date().toISOString()` | frontend sync service, backend routes (cursor) | ISO UTC string |
| `new Date(year, month, day)` | backend holiday service | ⚠️ Uses local timezone, not UTC |

---

## 9. Known Inconsistencies & Potential Issues

### 9.1 ⚠️ Mixed `new Date()` vs `dayjs()` for timestamp creation

**Backend services are inconsistent** in how they create timestamps for comparison:

- `timer.service.ts` uses `dayjs()` for conflict comparison — correct, respects UTC default.
- `balance.service.ts` uses `dayjs()` for conflict comparison — correct.
- `timelog.service.ts` uses `new Date()` for conflict comparison — **potentially inconsistent** on servers with non-UTC system timezone, since `new Date()` creates a Date in the system's local time but `>` comparison with a DB `timestamptz` value may behave differently than `dayjs().isAfter()`.
- `user-settings.service.ts` uses `new Date(since)` and `>` operator — same issue.

**Frontend sync** uses `new Date().toISOString()` for `updated_at` and `deleted_at` — this is fine since `.toISOString()` always returns UTC.

**Recommendation:** Standardize all backend timestamp creation/comparison to use `dayjs()` from the shared module for consistency.

### 9.2 ⚠️ `HolidayMetadata.last_updated` uses `timestamp` instead of `timestamptz`

All other date columns use `timestamptz`, but `HolidayMetadata.last_updated` uses bare `timestamp`. Additionally, `HolidayMetadata.created_at` and `updated_at` use `@CreateDateColumn()` / `@UpdateDateColumn()` **without** explicitly specifying `{ type: 'timestamptz' }`.

This means:
- `last_updated` stores server-local time without timezone info.
- `created_at`/`updated_at` may default to `timestamp` without tz depending on TypeORM/Postgres defaults.

**Recommendation:** Change to `timestamptz` for consistency with all other entities.

### 9.3 ⚠️ `Balance.deleted_at` uses `@CreateDateColumn` instead of `@Column`

In `backend/src/entities/Balance.ts`:

```ts
@CreateDateColumn({ type: 'timestamptz' })
deleted_at?: Date;
```

`deleted_at` should be a regular `@Column('timestamptz', { nullable: true })` since it's set manually on soft-delete, not auto-populated on creation. Using `@CreateDateColumn` means TypeORM will auto-set it to the creation timestamp, which makes every Balance appear soft-deleted from the moment it's created.

**Impact:** This is a **bug** — all balances are created with a non-null `deleted_at`, which may cause them to be incorrectly filtered out by soft-delete checks.

### 9.4 ⚠️ `new Date(year, 0, 1)` in holiday service uses local timezone

In `backend/src/services/holiday.service.ts`:

```ts
const startDate = new Date(year, 0, 1);  // Jan 1 in SERVER's local timezone
const endDate = new Date(year + 1, 0, 1);
```

This constructs dates in the **server's local timezone**, not UTC. If the server runs in a non-UTC timezone, the date range boundary could be off by hours when compared with `timestamptz` or `date` columns.

The same pattern appears in `holiday-crawler.service.ts` and `cleanup.service.ts`.

**Recommendation:** Use `new Date(Date.UTC(year, 0, 1))` or `dayjs.utc().year(year).startOf('year').toDate()`.

### 9.5 ⚠️ Inconsistent cursor generation across routes

Different route files generate the sync cursor differently:

| Route | Pattern |
|---|---|
| `timer.routes.ts` | `dayjs().toISOString()` |
| `balance.routes.ts` | `dayjs().toISOString()` |
| `target.routes.ts` | `dayjs().toISOString()` |
| `timelog.routes.ts` | `new Date().toISOString()` |
| `user-settings.routes.ts` | `new Date().toISOString()` |

While both produce UTC ISO strings, mixing patterns makes the codebase harder to audit. A single approach should be used.

**Recommendation:** Use `dayjs().toISOString()` everywhere for consistency.

### 9.6 ⚠️ Frontend mixes `new Date()` and `dayjs()` for elapsed time

In `frontend/src/stores/live-balance.ts`:

```ts
const now = new Date();
const startTime = new Date(timelog.start_timestamp);
const elapsedMs = now.getTime() - startTime.getTime();
```

This uses native `Date` instead of dayjs. While it works correctly (both are UTC-based when using `.getTime()`), it's inconsistent with the rest of the codebase.

### 9.7 ⚠️ `TargetSpec.starting_from` defaults to `CURRENT_TIMESTAMP`

```ts
@Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP' })
starting_from!: Date;
```

`CURRENT_TIMESTAMP` returns the transaction's start time in the session timezone. Since `starting_from` is semantically a **date** (which day the spec starts), storing a full timestamp with time-of-day information may cause off-by-one issues when comparing with `dayjs.utc(spec.starting_from).startOf('day')`. If a spec is created late at night UTC, the `startOf('day')` truncation in balance code could include/exclude a day unexpectedly.

**Recommendation:** Consider using `date` type or ensure the application always normalizes to start-of-day when creating target specs.

### 9.8 ⚠️ Holiday `date` column uses `date` type but entity expects `Date` object

The `Holiday` entity maps `date` to a PostgreSQL `date` column, which stores only the date part (no time). When TypeORM hydrates this as a JavaScript `Date`, the time portion is midnight UTC. Downstream code in `holiday-crawler.service.ts` creates dates with `new Date(holiday.date)` which parses the API's `YYYY-MM-DD` string as UTC midnight — this is correct. However, the `holiday.service.ts` compares these with `new Date(year, 0, 1)` (local timezone), which could mismatch.

### 9.9 ℹ️ Frontend stores create timestamps differently

- `targets.ts` uses `new Date().toISOString()` for `created_at`/`updated_at`.
- `timers.ts` uses `dayjs().toISOString()` for `created_at`/`updated_at`.
- `balances.ts` uses `dayjs().toISOString()` for `created_at`/`updated_at`.
- `base-store.ts` uses `dayjs().toISOString()` for `updated_at`.

Both produce the same result, but the inconsistency makes the code harder to maintain.

---

## 10. Summary of Date Flow

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                            │
│                                                          │
│  User input → dayjs (user timezone) → ISO string         │
│  Display    ← dayjs (locale format) ← ISO string         │
│  Storage    → IndexedDB (ISO strings)                    │
│  Sync       → POST JSON (ISO strings) ────────────────┐  │
│  Sync       ← GET JSON  (ISO strings) ←────────────┐  │  │
└──────────────────────────────────────────────────────┼──┼──┘
                                                       │  │
┌──────────────────────────────────────────────────────┼──┼──┐
│                      BACKEND                         │  │  │
│                                                      │  │  │
│  Route handler: dayjs(isoStr).toDate() ←─────────────┘  │  │
│  Route handler: entity.field.toISOString() ──────────────┘  │
│  Service layer: works with Date objects                      │
│  TypeORM entities: Date ↔ PostgreSQL timestamptz            │
│                                                              │
│  PostgreSQL: stores as UTC timestamptz                       │
└──────────────────────────────────────────────────────────────┘
```

### Rules of thumb

1. **Shared lib** uses `dayjs` from the shared module; dates are always **ISO strings**.
2. **Frontend** works with **ISO strings** everywhere; uses `dayjs` for manipulation and locale-aware display.
3. **Backend entities** use native **`Date` objects** (required by TypeORM).
4. **API boundary** is the conversion point: ISO strings ↔ Date objects.
5. **Balance dates** are plain strings (`YYYY-MM-DD`, `YYYY-MM`, `YYYY`) — not timestamps.
6. **All timestamps** should be UTC. Use `dayjs()` (not `new Date()`) in application code to ensure consistent UTC handling via the shared config.
