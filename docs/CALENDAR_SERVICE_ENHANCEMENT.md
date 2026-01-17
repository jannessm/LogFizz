# Calendar Service Enhancement - Timespan-Based Rendering

## Summary
Enhanced the calendar service to map timelogs to ALL dates they span (from start to end/now) and pre-compute multi-day range indicators for accurate calendar visualization.

## Key Improvements

### 1. **Timespan-Based Timelog Mapping**

**Before:**
```typescript
// Timelogs only appeared on their start date
const logDate = dayjs.utc(tl.start_timestamp).tz(logTimezone);
const dateStr = logDate.format('YYYY-MM-DD');
timeLogsByDate.get(dateStr).push(tl);
```

**After:**
```typescript
// Timelogs appear on ALL dates they span
const startDate = dayjs.utc(tl.start_timestamp).tz(logTimezone);
const endDate = tl.end_timestamp 
  ? dayjs.utc(tl.end_timestamp).tz(logTimezone)
  : dayjs(); // Use now for running timelogs

let currentDate = startDate.startOf('day');
const endDay = endDate.startOf('day');

while (currentDate.isSameOrBefore(endDay, 'day')) {
  const dateStr = currentDate.format('YYYY-MM-DD');
  timeLogsByDate.get(dateStr).push(tl);
  currentDate = currentDate.add(1, 'day');
}
```

**Benefits:**
- ✅ Multi-day events show on all relevant days
- ✅ Running timers appear on today even if started yesterday
- ✅ More intuitive and accurate calendar visualization
- ✅ Dots appear based on complete activity timespan

### 2. **Pre-Computed Multi-Day Ranges**

**New Feature:**
```typescript
interface MultiDayRangeInfo {
  isInRange: boolean;   // Is this date part of a multi-day range?
  isStart: boolean;     // Is this the first day?
  isEnd: boolean;       // Is this the last day?
  isMiddle: boolean;    // Is this a middle day?
  color: string | null; // Color for the range indicator
}

// Pre-computed for all calendar days
multiDayRanges: Map<string, MultiDayRangeInfo>
```

**Implementation:**
```typescript
// Calculate range for entire calendar view during store creation
let currentDay = firstMonth.startOf('month');
while (currentDay.isBefore(lastMonth, 'day')) {
  const dateStr = currentDay.format('YYYY-MM-DD');
  const rangeInfo = calculateMultiDayRange(currentDay, relevantLogs);
  multiDayRanges.set(dateStr, rangeInfo);
  currentDay = currentDay.add(1, 'day');
}
```

**Benefits:**
- ✅ No runtime calculations in calendar component
- ✅ Consistent O(1) lookup for all 42 calendar cells
- ✅ Reactive updates when timelogs change
- ✅ Cleaner component code

### 3. **Updated CalendarTimeLogData Interface**

```typescript
export interface CalendarTimeLogData {
  /** Map of date (YYYY-MM-DD) to ALL timelogs spanning that date */
  timeLogsByDate: Map<string, TimeLog[]>;
  
  /** Map of date (YYYY-MM-DD) to dot colors (max 3) based on all spanning timelogs */
  dotColors: Map<string, string[]>;
  
  /** Map of date (YYYY-MM-DD) to pre-computed multi-day range info */
  multiDayRanges: Map<string, MultiDayRangeInfo>;
}
```

## Examples

### Example 1: Multi-Day Sick Leave

**Scenario:** User logs sick leave from Jan 5-7, 2026

**Old Behavior:**
- Dot only appears on Jan 5
- No visual indication on Jan 6-7

**New Behavior:**
- Dot appears on Jan 5, 6, and 7
- Multi-day range indicator shows:
  - Jan 5: `isStart: true` (left rounded edge)
  - Jan 6: `isMiddle: true` (middle section)
  - Jan 7: `isEnd: true` (right rounded edge)

### Example 2: Running Timer

**Scenario:** User starts a work timer on Jan 3 at 9 AM, currently Jan 4 at 2 PM

**Old Behavior:**
- Dot only appears on Jan 3
- No indication on Jan 4 that work is ongoing

**New Behavior:**
- Dot appears on both Jan 3 and Jan 4
- Shows continuous activity across both days
- Updates reactively when timer is stopped

### Example 3: Month-Spanning Event

**Scenario:** Business trip from Dec 29, 2025 to Jan 2, 2026

**Old Behavior:**
- Only Dec 29 shows the event in December calendar
- Only Jan 1-2 show the event in January calendar

**New Behavior:**
- December calendar: Dec 29, 30, 31 all show the event
- January calendar: Jan 1, 2 show the event
- Proper visual continuity across month boundaries

## Performance Impact

### Computation Trade-offs

**More Work During Store Creation:**
- Iterates through all days in timelog spans
- Pre-computes multi-day ranges for entire calendar

**Less Work During Rendering:**
- No per-day filtering of timelogs
- No runtime multi-day range calculations
- Simple O(1) map lookups

**Net Result:** Better overall performance
- Calendar renders faster (42 cells × O(1) vs 42 cells × O(n))
- Computations happen once in derived store
- Svelte's reactivity ensures updates only when needed

## Implementation Details

### Files Modified

1. **`/frontend/src/services/calendar.ts`**
   - Added `MultiDayRangeInfo` interface
   - Updated `CalendarTimeLogData` interface
   - Enhanced timelog-to-date mapping logic
   - Added `calculateMultiDayRange()` helper function
   - Pre-compute multi-day ranges in `createCalendarStore()`

2. **`/frontend/src/components/history/HistoryCalendar.svelte`**
   - Access `multiDayRanges` from calendarData
   - Use pre-computed ranges instead of runtime calculation
   - Simplified `getMultiDayRangeForDate()` to simple lookup

3. **`/docs/CALENDAR_SERVICE.md`**
   - Updated documentation with new features
   - Added examples of timespan behavior
   - Documented MultiDayRangeInfo interface

## Testing Recommendations

1. **Multi-Day Events:**
   - Create a 3-day sick leave and verify dots appear on all 3 days
   - Verify range indicators show start/middle/end correctly

2. **Running Timers:**
   - Start a timer yesterday and verify dot appears today
   - Stop the timer and verify dot remains on both days

3. **Month Boundaries:**
   - Create an event spanning Dec 31 - Jan 2
   - Navigate between months and verify consistent display

4. **Performance:**
   - Load calendar with 100+ timelogs
   - Verify smooth rendering and navigation

## Migration Notes

**No Breaking Changes:**
- Existing code continues to work
- New `multiDayRanges` field added to CalendarTimeLogData
- Components can use pre-computed data or ignore it

**Recommended Updates:**
- Update calendar components to use `multiDayRanges` for better performance
- Remove runtime multi-day range calculations
- Leverage timespan-based `timeLogsByDate` for accurate day selection

## Future Enhancements

Potential improvements for future consideration:

1. **Configurable Range Calculation:**
   - Allow components to request different range calculation strategies
   - Example: "Show only start day" vs "Show all days"

2. **Range Grouping:**
   - Group consecutive days of same timer/type
   - Show as single continuous bar

3. **Timezone Edge Cases:**
   - Handle timelogs that cross day boundaries in different timezones
   - Consider DST transitions

4. **Performance Optimization:**
   - Implement virtual scrolling for very large date ranges
   - Cache calculations across multiple calendar instances
