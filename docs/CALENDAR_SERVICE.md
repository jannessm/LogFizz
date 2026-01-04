# Calendar Service

## Overview
The calendar service provides centralized caching and calculation of timelog data for calendar views. It improves performance by pre-computing expensive operations and provides a clean separation of concerns.

## Features

### 1. **Centralized Data Processing**
- Pre-computes timelog lookups by date (O(1) access)
- Pre-calculates dot colors for calendar display (max 3 per day)
- **Maps timelogs to ALL dates they span** (start to end/now)
- **Pre-computes multi-day range indicators** for efficient rendering
- Filters timelogs for specific month ranges

### 2. **Smart Timespan Calculation**
- Dots appear on ALL days a timelog spans, not just the start date
- Running timelogs (no end_timestamp) show on today as well
- Multi-day ranges (sick leave, holidays, etc.) pre-computed per date

### 3. **Reactive Store Integration**
- Returns Svelte stores that automatically update when timelogs or timers change
- No manual cache invalidation needed
- Efficient reactivity using Svelte's derived stores

### 3. **Helper Functions**
- `getTypeColor()` - Get color for timelog types (sick, holiday, etc.)
- `getMultiDayRange()` - Check if a date is within a multi-day timelog
- `hasSpecialType()` - Check if a date has special type timelogs
- `loadCalendarMonth()` - Preload timelogs for a month range

## API

### `createCalendarStore(year, month, range, timers)`

Creates a derived store with pre-computed calendar data.

**Parameters:**
- `year` (number) - Year to display (e.g., 2026)
- `month` (number) - Month to display (1-12)
- `range` (number) - Number of months before/after to include (default: 1)
- `timers` (Timer[]) - Array of timers for color lookup

**Returns:**
```typescript
Readable<CalendarTimeLogData>

interface CalendarTimeLogData {
  timeLogsByDate: Map<string, TimeLog[]>;     // YYYY-MM-DD -> timelogs spanning that date
  dotColors: Map<string, string[]>;           // YYYY-MM-DD -> colors (max 3)
  multiDayRanges: Map<string, MultiDayRangeInfo>; // YYYY-MM-DD -> range info
}

interface MultiDayRangeInfo {
  isInRange: boolean;   // Is this date part of a multi-day range?
  isStart: boolean;     // Is this the first day of the range?
  isEnd: boolean;       // Is this the last day of the range?
  isMiddle: boolean;    // Is this a middle day of the range?
  color: string | null; // Color for the range indicator
}
```

**Key Behavior:**
- **Timespan Mapping:** Timelogs are mapped to ALL dates they span
  - Example: A timelog from Jan 1-3 appears in `timeLogsByDate` for '2026-01-01', '2026-01-02', and '2026-01-03'
  - Running timelogs (no end_timestamp) span from start to current date/time
- **Dot Colors:** Calculated based on all timelogs that touch a day (not just those starting on that day)
- **Multi-Day Ranges:** Pre-computed for efficient calendar rendering

**Example:**
```typescript
const calendarStore = createCalendarStore(2026, 1, 1, timers);
const data = $calendarStore;

// Access timelogs for a specific date (includes all timelogs spanning that date)
const logsFor2026Jan01 = data.timeLogsByDate.get('2026-01-01');
// Example: If a timelog runs from Dec 31, 2025 to Jan 2, 2026, 
// it will appear in logs for Dec 31, Jan 1, and Jan 2

// Access dot colors for a specific date (based on all spanning timelogs)
const colorsFor2026Jan01 = data.dotColors.get('2026-01-01');

// Access pre-computed multi-day range info
const rangeInfo = data.multiDayRanges.get('2026-01-01');
if (rangeInfo.isStart) {
  console.log('First day of a multi-day range');
}
```

### `loadCalendarMonth(year, month, range)`

Loads timelogs for a specific month range into the store.

**Parameters:**
- `year` (number) - Year to load
- `month` (number) - Month to load (1-12)
- `range` (number) - Number of months before/after to load (default: 1)

**Returns:** `Promise<void>`

**Example:**
```typescript
// Load December 2025 and adjacent months (Nov 2025, Jan 2026)
await loadCalendarMonth(2025, 12, 1);
```

### `getTypeColor(type)`

Get the color for a timelog type.

**Parameters:**
- `type` (string) - Timelog type ('sick', 'holiday', 'business-trip', 'child-sick', 'normal')

**Returns:** `string | null` - Hex color or null for normal type

### `getMultiDayRange(date, timeLogs)`

Check if a date is within a multi-day timelog range.

**Parameters:**
- `date` (dayjs.Dayjs) - Date to check
- `timeLogs` (TimeLog[]) - Array of all timelogs

**Returns:**
```typescript
{
  isInRange: boolean;
  isStart: boolean;
  isEnd: boolean;
  isMiddle: boolean;
  color: string | null;
}
```

### `hasSpecialType(date, timeLogsByDate, timeLogs)`

Check if a date has special type timelogs (non-normal).

**Parameters:**
- `date` (dayjs.Dayjs) - Date to check
- `timeLogsByDate` (Map<string, TimeLog[]>) - Pre-computed timelog lookup map
- `timeLogs` (TimeLog[]) - Array of all timelogs

**Returns:**
```typescript
{
  hasSpecial: boolean;
  color: string | null;
}
```

## Usage Example

### In a Svelte Component

```svelte
<script lang="ts">
  import { createCalendarStore, loadCalendarMonth } from '../services/calendar';
  import { timers } from '../stores/timers';
  import { onMount } from 'svelte';
  
  let currentMonth = $state(dayjs());
  
  // Create reactive calendar store
  let calendarStore = $derived(
    createCalendarStore(
      currentMonth.year(),
      currentMonth.month() + 1,
      1,
      $timers
    )
  );
  let calendarData = $derived($calendarStore);
  
  onMount(async () => {
    // Load initial data
    await loadCalendarMonth(currentMonth.year(), currentMonth.month() + 1);
  });
  
  // When month changes, load new data
  async function handleMonthChange(newMonth: dayjs.Dayjs) {
    currentMonth = newMonth;
    await loadCalendarMonth(newMonth.year(), newMonth.month() + 1);
  }
</script>

<div>
  {#each calendarDays as day}
    {@const dateStr = day.format('YYYY-MM-DD')}
    {@const colors = calendarData.dotColors.get(dateStr) || []}
    {@const logs = calendarData.timeLogsByDate.get(dateStr) || []}
    
    <div class="day">
      {day.date()}
      {#each colors as color}
        <span class="dot" style="background: {color}"></span>
      {/each}
    </div>
  {/each}
</div>
```

## Benefits

### Performance
- **O(1) lookups** instead of O(n) filtering for each calendar day
- **Pre-computed colors** calculated once instead of 42 times (calendar grid)
- **Pre-computed multi-day ranges** - no runtime calculations needed
- **Memoization** through Svelte's derived stores

### Accuracy
- **Correct timespan representation** - timelogs appear on ALL days they cover
  - Running timers show on current day even if started yesterday
  - Multi-day events (sick leave, vacation) show on all relevant days
  - More intuitive calendar visualization
- **Consistent dot colors** based on complete timelog duration

### Maintainability
- **Separation of concerns** - calendar logic separated from UI
- **Reusability** - can be used by multiple components
- **Testability** - pure functions easy to unit test

### Developer Experience
- **Type-safe** - Full TypeScript support
- **Reactive** - Automatic updates when data changes
- **Clean API** - Simple, intuitive interface

## Migration from Old Code

### Before (Manual Caching in Component)
```svelte
<script>
  let timeLogs = $state(new Map<string, TimeLog[]>());
  let calendarTimeLogs = $state([] as TimeLog[]);
  
  async function loadMonthLogs(year: number, month: number) {
    const promises = [];
    const timelogs: TimeLog[] = [];
    for (let i = -1; i <= 1; i++) {
      const monthToLoad = dayjs().year(year).month(month).add(i, 'month');
      const key = `${monthToLoad.year()}-${monthToLoad.month() + 1}`;
      if (!timeLogs.has(key)) {
        promises.push(timeLogsStore.loadLogsByYearMonth(...).then(logs => {
          timeLogs.set(key, logs);
          timelogs.push(...logs);
        }));
      }
    }
    await Promise.all(promises);
    calendarTimeLogs = timelogs;
  }
</script>
```

### After (Using Calendar Service)
```svelte
<script>
  import { createCalendarStore, loadCalendarMonth } from '../services/calendar';
  
  let calendarStore = $derived(
    createCalendarStore(currentMonth.year(), currentMonth.month() + 1, 1, $timers)
  );
  let calendarData = $derived($calendarStore);
  
  async function handleMonthChange(newMonth: dayjs.Dayjs) {
    currentMonth = newMonth;
    await loadCalendarMonth(newMonth.year(), newMonth.month() + 1);
  }
</script>
```

## File Location
`/frontend/src/services/calendar.ts`

## Dependencies
- `svelte/store` - For derived stores
- `../stores/timelogs` - Timelog store
- `../types` - Type definitions
