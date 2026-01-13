# Timelog Loading Refactor - Performance Improvements

## Summary
Refactored the timelog loading mechanism in the History view to improve rendering performance and leverage Svelte 5's reactive state management for automatic updates.

## Bug Fixes

### Critical: Timelogs Appearing and Disappearing (Flickering)
**Problem:** After the initial fix for month 12, timelogs would appear briefly then disappear. This was caused by creating a new derived store on every render cycle:

```svelte
// WRONG - Creates a new store every time currentMonth changes
let calendarTimeLogsStore = $derived(
  getTimeLogsForMonthRange(currentMonth.year(), currentMonth.month() + 1, 1)
);
let calendarTimeLogs = $derived($calendarTimeLogsStore);
```

Each time `currentMonth` changed, `$derived` would create a brand new store, causing the subscription to reset and the UI to flicker.

**Solution:** 
Use `$derived.by()` to create a single reactive computation that directly filters the store's items:

```svelte
// CORRECT - Single reactive computation
let calendarTimeLogs = $derived.by(() => {
  const year = currentMonth.year();
  const month = currentMonth.month() + 1;
  const logs: TimeLog[] = [];
  
  for (let i = -1; i <= 1; i++) {
    const targetDate = dayjs().year(year).month(month - 1).date(1).add(i, 'month');
    const targetYear = targetDate.year();
    const targetMonth = targetDate.month() + 1;
    
    const monthLogs = $timeLogsStore.items.filter((tl: TimeLog) => {
      const logYear = tl.year ?? dayjs(tl.start_timestamp).year();
      const logMonth = tl.month ?? (dayjs(tl.start_timestamp).month() + 1);
      return logYear === targetYear && logMonth === targetMonth;
    });
    logs.push(...monthLogs);
  }
  
  return logs;
});
```

This approach:
- Subscribes to `$timeLogsStore` once
- Reactively updates when either `currentMonth` or `$timeLogsStore` changes
- Doesn't create new store instances
- Maintains stable subscriptions

### Critical: Month 12 (December) Loading Issue
**Problem:** When calculating adjacent months to load, the code was using `dayjs().year(year).month(month - 1).add(i, 'month')` without setting a specific day. This caused issues when:
- Current date is the 31st and navigating to a month with fewer days
- Navigating to/from December (month 12)
- Day overflow causes dayjs to roll over to the next month incorrectly

**Example of the bug:**
```javascript
// If today is January 31st, 2026:
dayjs().year(2025).month(11).add(1, 'month')
// month(11) = December, but there's no December 31st in the calculation
// This could cause unexpected month rollovers
```

**Solution:** 
Set the date to the 1st of the month before performing month arithmetic:
```javascript
// Before (buggy):
const monthToLoad = dayjs().year(year).month(month - 1).add(i, 'month');

// After (fixed):
const monthToLoad = dayjs().year(year).month(month - 1).date(1).add(i, 'month');
```

This fix was applied in:
- `History.svelte` - `loadMonthRange()` function
- `timelogs.ts` - `getTimeLogsForMonthRange()` function

## Key Changes

### 1. Fixed Month Indexing Bug in `timelogs.ts`
**Problem:** The `loadLogsByYearMonth` function was incorrectly adding 1 to the month parameter when it was already 1-12 indexed, causing it to load the wrong month from IndexedDB.

**Solution:** 
- Removed the `month + 1` adjustment in the `getTimeLogsByYearMonth` call
- Added clear documentation that month parameter is 1-12 (same as dayjs.month() + 1)
- Added `getLoadedMonths()` method for external access to loaded month tracking

### 2. Enhanced Store with Derived Stores
**Added two new helper functions:**

```typescript
// Get timelogs for a month range (useful for calendar views)
getTimeLogsForMonthRange(year: number, month: number, range: number = 1)

// Get timelogs for a specific date
getTimeLogsForDate(date: string)
```

These functions return derived stores that automatically update when the underlying timelog store changes, eliminating manual cache management.

### 3. Refactored History.svelte
**Before:**
- Used manual `Map<string, TimeLog[]>` for caching
- Used `$state` for calendarTimeLogs array
- Manual cache invalidation and updates
- Redundant filtering on every render

**After:**
- Uses derived store from `getTimeLogsForMonthRange()`
- Automatic reactivity via `$derived` 
- No manual cache management needed
- Simplified month change handling

```svelte
// Old approach
let timeLogs = $state(new Map<string, TimeLog[]>());
let calendarTimeLogs = $state([] as TimeLog[]);

// New approach
let calendarTimeLogsStore = $derived(
  getTimeLogsForMonthRange(currentMonth.year(), currentMonth.month() + 1, 1)
);
let calendarTimeLogs = $derived($calendarTimeLogsStore);
```

### 4. Optimized HistoryCalendar.svelte
**Performance improvements:**

1. **Memoized timelog lookups by date** using `$derived.by()`:
   - Created `timeLogsByDate` map for O(1) lookups instead of filtering arrays repeatedly
   - Eliminates redundant array filtering for each calendar day

2. **Memoized dot colors** using `$derived.by()`:
   - Pre-computed dot colors for all 42 calendar cells
   - Only recalculates when `timeLogs` or `calendarDays` change
   - Replaced imperative `$effect()` with declarative `$derived.by()`

3. **Updated helper functions** to use memoized data:
   - `hasSpecialType()` now uses `timeLogsByDate` instead of filtering

**Before:**
```svelte
let dotColors = $state<Map<string, string[]>>(new Map());

$effect(() => {
  dotColors = getTimelogsColorsMap(); // Runs on every change
});

function getTimelogsColorsForDate(date: dayjs.Dayjs): string[] {
  const dateTimeLogs = timeLogs.filter(tl => { /* ... */ }); // Expensive
  // ...
}
```

**After:**
```svelte
// Memoize timelog lookups by date
let timeLogsByDate = $derived.by(() => {
  const map = new Map<string, TimeLog[]>();
  for (const tl of timeLogs) {
    // Group by date
  }
  return map;
});

// Memoize all dot colors at once
let dotColors = $derived.by(() => {
  const colorMap = new Map<string, string[]>();
  for (const day of calendarDays) {
    const dateTimeLogs = timeLogsByDate.get(dateStr) || [];
    // Calculate colors
  }
  return colorMap;
});
```

## Benefits

1. **Faster Rendering:** 
   - Eliminated redundant array filtering (42 days × N timelogs → 1 pass)
   - Pre-computed lookups reduce calendar render time significantly

2. **Automatic Updates:**
   - Derived stores automatically update components when timelogs change
   - No manual cache invalidation needed
   - Svelte's reactivity handles all updates

3. **Better Caching:**
   - Store-level month tracking prevents duplicate loads
   - Derived stores share computed results across components

4. **Cleaner Code:**
   - Declarative `$derived` instead of imperative `$effect`
   - Less state management boilerplate
   - Clear data flow from store → derived → component

5. **Type Safety:**
   - All derived stores are properly typed
   - TypeScript catches potential issues at compile time

## Migration Notes

- **No breaking changes** - API remains compatible
- Components using `timeLogsStore` automatically benefit from improvements
- Existing code continues to work while getting performance benefits

## Testing Recommendations

1. Verify calendar renders correctly with large timelog datasets
2. Test month navigation performance (should be instant for loaded months)
3. Confirm timelog updates reflect immediately in calendar
4. Check that import functionality still works correctly
