# Test Coverage for Break Calculation in Timelog Editing

## Summary

Added comprehensive test coverage to ensure that breaks are correctly subtracted when calculating the duration of a timelog when editing it in the frontend.

## German Break Rules

The system implements German labor law break requirements:
- **6+ hours worked**: 30 minutes break subtracted
- **9+ hours worked**: 45 minutes break subtracted

## Files Added

### 1. `/frontend/src/components/TimelogForm.test.ts`

A comprehensive test suite for the `TimelogForm` component with 15 test cases covering:

#### Basic Functionality Tests
- Rendering of add and edit forms
- Form validation (end time must be after start time)
- Running checkbox visibility based on mode
- Delete button only shown when editing
- Form field population and validation

#### Break Calculation Tests (Key Tests)

**Test: "correctly handles editing a timelog with apply_break_calculation enabled"**
- Tests editing a timelog that has `apply_break_calculation: true`
- Verifies the form correctly displays and handles timelogs from buttons with `auto_subtract_breaks` enabled
- Example: Editing a 10-hour session (600 min) to 7 hours should result in 7 hours (420 min) - 30 min break = 390 min

**Test: "correctly handles editing a timelog from button without auto_subtract_breaks"**
- Tests editing a timelog that has `apply_break_calculation: false`
- Verifies no break subtraction occurs for buttons without the auto-subtract feature
- Example: 7 hours = 420 minutes (no break subtraction)

### 2. `/frontend/src/stores/timelogs.test.ts`

A focused test suite for the `timeLogsStore` specifically testing break calculation logic:

#### Update with Break Calculation Tests

1. **10-hour session with breaks enabled**
   - Input: 10 hours (600 min) with `apply_break_calculation: true`
   - Expected: 555 minutes (600 - 45)

2. **7-hour session with breaks enabled**
   - Input: 7 hours (420 min) with `apply_break_calculation: true`
   - Expected: 390 minutes (420 - 30)

3. **10-hour session with breaks disabled**
   - Input: 10 hours (600 min) with `apply_break_calculation: false`
   - Expected: 600 minutes (no subtraction)

4. **Preserving apply_break_calculation flag**
   - Verifies that the flag from the existing timelog is preserved during updates

5. **Edge case: exactly 6 hours**
   - Input: Exactly 6 hours (360 min) with `apply_break_calculation: true`
   - Expected: 330 minutes (360 - 30)
   - Confirms that >= 6 hours triggers the 30-minute break

6. **Edge case: exactly 9 hours**
   - Input: Exactly 9 hours (540 min) with `apply_break_calculation: true`
   - Expected: 495 minutes (540 - 45)
   - Confirms that >= 9 hours triggers the 45-minute break

7. **Updating both start and end timestamps**
   - Tests that break calculation works correctly when both timestamps are modified

#### Stop Timer with Break Calculation Test

**Test: "should apply break calculation when stopping a timer"**
- Tests that when stopping a running timer, breaks are correctly applied
- Example: 10-hour timer with `apply_break_calculation: true` → 555 minutes

## How Break Calculation Works

### Data Flow

1. **Button Configuration**: Each `Button` has an `auto_subtract_breaks` boolean property
2. **TimeLog Flag**: Each `TimeLog` has an `apply_break_calculation` boolean property
3. **Duration Calculation**: The `computeDurationMinutes()` function in `timelogs.ts` applies the break rules

### Code Structure

```typescript
function computeDurationMinutes(
  startTs: string | Date, 
  endTs: string | Date, 
  applyBreaks: boolean | undefined
): number {
  const start = new Date(startTs);
  const end = new Date(endTs);
  let minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

  if (applyBreaks) {
    if (minutes >= 9 * 60) {
      minutes -= 45;
    } else if (minutes >= 6 * 60) {
      minutes -= 30;
    }
  }

  return Math.max(0, minutes);
}
```

### Update Flow

When a user edits a timelog through the `TimelogForm`:

1. Form dispatches `save` event with updated timestamps
2. Parent component (Dashboard/History) calls `timeLogsStore.update()`
3. Store retrieves existing timelog (including `apply_break_calculation` flag)
4. Store calls `computeDurationMinutes()` with the flag
5. Duration is calculated with or without breaks based on the flag
6. Updated timelog is saved

## Testing Strategy

The tests verify:
1. **Component level**: The `TimelogForm` correctly handles and displays timelogs with different break calculation settings
2. **Store level**: The `timeLogsStore.update()` method correctly calculates durations with break subtraction
3. **Edge cases**: Boundary conditions (6 hours, 9 hours) are handled correctly
4. **Flag preservation**: The `apply_break_calculation` flag is preserved through updates

## Running the Tests

```bash
# Run all frontend tests
cd frontend
npm test

# Run specific test files
npm test TimelogForm.test.ts
npm test timelogs.test.ts

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

## Related Files

- `/frontend/src/components/TimelogForm.svelte` - The form component for editing timelogs
- `/frontend/src/stores/timelogs.ts` - Store managing timelog CRUD operations
- `/frontend/src/routes/Dashboard.svelte` - Uses TimelogForm for editing active timers
- `/frontend/src/routes/History.svelte` - Uses TimelogForm for editing historical timelogs
- `/lib/types/index.ts` - Type definitions for TimeLog and Button

## Notes

- The actual break calculation happens in the store, not in the component
- The `apply_break_calculation` flag is set when a timelog is created based on the button's `auto_subtract_breaks` setting
- The flag is preserved through updates, ensuring consistent behavior
- Break rules are based on total duration (including breaks), not worked time
