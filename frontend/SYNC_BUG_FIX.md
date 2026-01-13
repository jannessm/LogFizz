# Sync Bug Fix: December Timelogs Disappearing

## Problem
After syncing timelogs, the timelogs for December (and any other loaded month besides the current month) were being removed from the store.

## Root Cause
The base store's `afterSync` callback was calling `load(false)`, which:
1. Calls `config.db.getAll()` to fetch items from IndexedDB
2. For timelogs, `getAll()` is configured to only fetch the **current month** via `getTimeLogsByYearMonth(currentYear, currentMonth)`
3. The store's items array gets replaced with only the current month's timelogs
4. Any previously loaded months (like December when viewing it in the calendar) are lost

## Solution
Override the `load()` method in `timeLogsStore` to:
1. Register a **custom afterSync callback** that calls `reloadAllLoadedMonths()` instead of the default `load(false)`
2. The `reloadAllLoadedMonths()` function:
   - Iterates through the `loadedMonths` Set (which tracks all year-month combinations that have been loaded)
   - Fetches timelogs for each loaded month from IndexedDB
   - Combines all timelogs into a single array
   - Updates the store with the complete set of loaded timelogs

## Changes Made

### 1. Added `reloadAllLoadedMonths()` function
```typescript
async function reloadAllLoadedMonths(): Promise<void> {
  const months = Array.from(loadedMonths);
  const allTimeLogs: TimeLog[] = [];
  
  for (const monthKey of months) {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    
    const logs = await getTimeLogsByYearMonth(year, month);
    allTimeLogs.push(...logs);
  }
  
  // Update the store with all loaded timelogs
  baseStore.updateWriteable(state => ({
    ...state,
    items: allTimeLogs,
    isLoading: false
  }));
}
```

### 2. Overrode `load()` method
```typescript
async load(sync: boolean = true) {
  baseStore.updateWriteable(state => ({ ...state, isLoading: true, error: null }));

  // Register custom afterSync callback that reloads all loaded months
  if (!baseStore.syncCallbackRegistered) {
    syncService.afterSync(timeLogStoreConfig.sync.syncType, async () => {
      await reloadAllLoadedMonths();
    });
    baseStore.syncCallbackRegistered = true;
  }

  // ... rest of load implementation
}
```

## How It Works

### Before Fix
1. User navigates to December, loads December timelogs
2. `loadedMonths` Set contains: `["2024-1", "2024-12"]` (current month + December)
3. User syncs timelogs
4. afterSync callback runs → calls `load(false)`
5. `load()` fetches only current month → `getTimeLogsByYearMonth(2024, 1)`
6. Store items get replaced with only January timelogs
7. December timelogs are gone! 😞

### After Fix
1. User navigates to December, loads December timelogs
2. `loadedMonths` Set contains: `["2024-1", "2024-12"]` (current month + December)
3. User syncs timelogs
4. afterSync callback runs → calls `reloadAllLoadedMonths()`
5. `reloadAllLoadedMonths()` fetches timelogs for both January AND December
6. Store items get updated with all loaded months
7. December timelogs persist! 🎉

## Benefits
- Maintains data integrity after sync operations
- Preserves user's navigation state (previously loaded months remain accessible)
- No unnecessary re-fetching of data that wasn't loaded
- Clean separation of concerns (timelog-specific sync behavior)

## Testing Checklist
- [ ] Load current month timelogs
- [ ] Navigate to December and load December timelogs
- [ ] Trigger a sync operation
- [ ] Verify December timelogs are still visible
- [ ] Navigate back to current month
- [ ] Verify current month timelogs are still visible
- [ ] Test with multiple loaded months (e.g., January, December, November)
- [ ] Verify no performance degradation with multiple loaded months
