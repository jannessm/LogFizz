# Frontend Refactoring TODO - Balance Design Implementation

This TODO tracks the necessary changes to align the frontend with the refactored balance design documented in `docs/balances.md`.

## Overview of Changes

The backend has been refactored to implement a new balance calculation system:
- **Button → Timer** (renamed entity with `timer_id`, added `archived` field)
- **DailyTarget → Target + TargetSpec** (split into two entities)
- **MonthlyBalance → Balance** (unified Balance entity for daily/monthly/yearly)
- New balance calculation flow (bottom-up: Daily → Monthly → Yearly)
- New timelog types: `normal`, `sick`, `holiday`, `business-trip`, `child-sick`
- Added `whole_day` flag to timelogs

---

## 1. Type System Updates

### 1.1 Update Type Imports
- [ ] **File: `src/types/index.ts`**
  - [ ] Remove `Button` export, add `Timer` export
  - [ ] Remove `DailyTarget` export, add `Target` and `TargetSpec` exports
  - [ ] Remove `MonthlyBalance` export, add `Balance` export
  - [ ] Verify all types are re-exported from `@clock/shared/types`

---

## 2. Database Layer (IndexedDB)

### 2.1 Database Schema Migration
- [ ] **File: `src/lib/db.ts`**
  - [ ] Rename `buttons` table to `timers`
  - [ ] Rename `daily_targets` table to `targets`
  - [ ] Rename `monthly_balances` table to `balances`
  - [ ] Update indexes:
    - [ ] Add index on `balances`: `[user_id, target_id, date]`

### 2.2 Update DB Functions
- [ ] **File: `src/lib/db.ts`**
  - [ ] Rename all `button` functions to `timer` (e.g., `getButton` → `getTimer`)
  - [ ] Update `target` functions to work with new Target + TargetSpec structure
  - [ ] Update balance functions:
    - [ ] `getAllBalances()` - replaces `getAllMonthlyBalances()`
    - [ ] `getBalancesByDate(date: string, granularity: 'daily' | 'monthly' | 'yearly')`
    - [ ] `getBalancesByTargetId(targetId: string)`
    - [ ] `saveBalance(balance: Balance)`
    - [ ] `deleteBalance(id: string)`

---

## 3. Store Updates

### 3.1 Buttons → Timers Store
- [ ] **File: `src/stores/buttons.ts` → `src/stores/timers.ts`**
  - [ ] Rename file from `buttons.ts` to `timers.ts`
  - [ ] Update all references from `button` to `timer`
  - [ ] Add `archived` field support
  - [ ] Update sync service calls to use timer endpoints
  - [ ] Update default values in `create()` method

- [ ] **Update imports across codebase**
  - [ ] Find all imports of `stores/buttons` and update to `stores/timers`
  - [ ] Update variable names: `buttons` → `timers`, `button` → `timer`

### 3.2 Targets Store Refactor
- [ ] **File: `src/stores/targets.ts`**
  - [ ] Remove old `DailyTarget` references
  - [ ] Update to use `Target` type (`Target_Specs` are not a separate type for the frontend!) 
  - [ ] Update `update()` method to handle TargetSpec updates
  - [ ] Update `delete()` method to cascade delete TargetSpecs
  - [ ] Update fields from Target to support an array of targetSpecs:

### 3.3 Monthly Balances → Balances Store
- [ ] **File: `src/stores/monthly-balances.ts` → `src/stores/balances.ts`**
  - [ ] Rename file from `monthly-balances.ts` to `balances.ts`
  - [ ] Remove dependency on removed `@clock/shared/monthlyBalance`
  - [ ] Update to use `Balance` type instead of `MonthlyBalance`
  - [ ] Implement new balance calculation flow from `lib/utils/balance.ts`:
    - [ ] Use `calculateDueMinutes(date, target, targetSpecs, holidays)`
    - [ ] Use `calculateWorkedMinutesForDate(date, timelogs)`
    - [ ] Use `aggregateToMonthly(dailyBalances, previousCumulation)`
    - [ ] Use `aggregateToYearly(monthlyBalances, previousCumulation)`
  - [ ] Remove old calculation methods:
    - [ ] `balanceNeedsRecalculation()` - replaced by balance calculation logic
    - [ ] `calculateMonthlyBalance()` - moved to lib
  - [ ] Add new methods:
    - [ ] `calculateDailyBalances(targetId, year, month)` - creates daily balances
    - [ ] `calculateMonthlyBalances(targetId, year)` - aggregates to monthly
    - [ ] `calculateYearlyBalances(targetId)` - aggregates to yearly
    - [ ] `recalculateBalances(targetId?)` - full recalculation
    - [ ] `getBalancesByGranularity(granularity: 'daily' | 'monthly' | 'yearly')`
  - [ ] Update balance linking:
    - [ ] Implement `next_balance_id` linking (same granularity)
    - [ ] Implement `parent_balance_id` linking (daily → monthly → yearly)
  - [ ] Update fields in balance creation:
    - [ ] Add `cumulative_minutes` calculation
    - [ ] Add `worked_days` calculation
    - [ ] Add special day counters: `sick_days`, `holidays`, `business_trip`, `child_sick`
  - [ ] Remove obsolete fields:
    - [ ] Remove `balance_minutes` (replaced by `cumulative_minutes`)
    - [ ] Remove `exclude_holidays` (moved to TargetSpec)
    - [ ] Remove `hash` (no longer using hash-based recalculation)

### 3.4 Timelogs Store Updates
- [ ] **File: `src/stores/timelogs.ts`**
  - [ ] Update references from `button_id` to `timer_id`
  - [ ] Add support for new `type` field (`TimeLogType`)
  - [ ] Add support for `whole_day` field
  - [ ] Update `create()` and `update()` methods to include new fields
  - [ ] Implement balance propagation on timelog changes:
    - [ ] On upsert: trigger balance recalculation for affected dates
    - [ ] On delete: trigger balance recalculation for affected dates
  - [ ] Add helper method: `getAffectedDates(timelog: TimeLog)` - handles multi-day logs
  - [ ] Update duration calculation to use `calculateTimelogDuration()` from lib

---

## 4. Component Updates

### 4.1 Timer Components (formerly Button)
- [ ] **Rename components:**
  - [ ] `src/components/ButtonGrid.svelte` → `TimerGrid.svelte`
  - [ ] `src/components/ButtonForm.svelte` → `TimerForm.svelte`
  - [ ] Any other button-related component files

- [ ] **Update component internals:**
  - [ ] Replace all `button` props/variables with `timer`
  - [ ] Update store imports: `buttons` → `timers`
  - [ ] Add UI for `archived` field toggle
  - [ ] Update sync calls to use timer endpoints

### 4.2 Target Components
- [ ] **File: `src/components/TargetForm.svelte`**
  - [ ] Update form to handle Target + TargetSpec split:
    - [ ] Separate sections for Target (name) and TargetSpec (schedule details)
    - [ ] Support multiple TargetSpecs per Target
    - [ ] Add UI for `starting_from` and `ending_at` dates
  - [ ] Update validation logic for new structure
  - [ ] Update submit handler to create both Target and TargetSpec
  - [ ] Add ability to add/edit/delete multiple TargetSpecs

- [ ] **File: `src/components/DailyTargets.svelte`**
  - [ ] Update to fetch and display Target with its TargetSpecs
  - [ ] Update display logic to show applicable TargetSpec for current date
  - [ ] Update references from `DailyTarget` to `Target`

### 4.3 Balance Components
- [ ] **File: `src/components/History/MonthlyBalance.svelte`**
  - [ ] Rename to `BalanceView.svelte` (supports all granularities)
  - [ ] Add granularity selector: Daily / Monthly / Yearly
  - [ ] Update to use new `Balance` type
  - [ ] Update displayed fields:
    - [ ] Remove `balance_minutes`, show `cumulative_minutes`
    - [ ] Add `worked_days` display
    - [ ] Add special day counters display (sick, holidays, etc.)
  - [ ] Add navigation between linked balances:
    - [ ] Navigate to next balance (via `next_balance_id`)
    - [ ] Navigate to parent balance (via `parent_balance_id`)
    - [ ] Drill down to child balances
  - [ ] Add recalculation trigger button (per design doc)

- [ ] **File: `src/components/DailyBalance.svelte`**
  - [ ] Update to use new `Balance` type with `date` field
  - [ ] Update calculation to use lib utilities
  - [ ] Add support for displaying special day types
  - [ ] Update styling to differentiate balance types

### 4.4 Timelog Components
- [ ] **File: `src/components/TimelogForm.svelte`**
  - [ ] Update `button_id` to `timer_id`
  - [ ] Add `type` selector dropdown (normal, sick, holiday, business-trip, child-sick)
  - [ ] Add `whole_day` checkbox
  - [ ] Update validation: if `whole_day`, don't require end_timestamp
  - [ ] Update UI hints based on selected type
  - [ ] Update form submission to include new fields

- [ ] **File: `src/components/History/ImportTimelogsModal.svelte`**
  - [ ] Update to support new timelog structure
  - [ ] Update mapping to use `timer_id` instead of `button_id`
  - [ ] Add option to set `type` for imported logs

---

## 5. Service Layer Updates

### 5.1 Sync Service
- [ ] **File: `src/services/sync.ts`**
  - [ ] Rename all button-related methods to timer:
    - [ ] `queueUpsertButton` → `queueUpsertTimer`
    - [ ] `queueDeleteButton` → `queueDeleteTimer`
    - [ ] `syncButtons` → `syncTimers`
  - [ ] Update balance sync methods:
    - [ ] Rename `syncMonthlyBalances` → `syncBalances`
    - [ ] Update to handle all balance granularities
    - [ ] Update balance sync to use new `Balance` structure
  - [ ] Update API endpoint references to match backend changes
  - [ ] Update SyncQueueItem type usage (add 'balance' type)

### 5.2 API Service
- [ ] **File: `src/services/api.ts`**
  - [ ] Update endpoint constants:
    - [ ] `/buttons` → `/timers`
    - [ ] `/targets` endpoints (verify structure)
    - [ ] `/monthly-balances` → `/balances`
  - [ ] Update request/response types to match new backend structure
  - [ ] Add methods for TargetSpec CRUD operations

---

## 6. View/Page Updates

### 6.1 History View
- [ ] **File: `src/routes/history/+page.svelte`**
  - [ ] Update to use new balance components
  - [ ] Add granularity toggle (daily/monthly/yearly view)
  - [ ] Update balance display to show new fields
  - [ ] Update recalculation trigger
  - [ ] Update timelog list to show `type` and `whole_day` indicators

### 6.2 Dashboard View
- [ ] **File: `src/routes/+page.svelte`** (if exists)
  - [ ] Update timer references (button → timer)
  - [ ] Update target display to show active TargetSpec
  - [ ] Update balance summary to use new Balance type

### 6.3 Settings/Configuration Views
- [ ] Update any settings pages that reference:
  - [ ] Buttons → Timers
  - [ ] Targets (to handle TargetSpecs)
  - [ ] Balance configuration

---

## 7. Testing Updates

### 7.1 Unit Tests
- [ ] **File: `src/stores/timelogs.test.ts`**
  - [ ] Update test cases for `timer_id` instead of `button_id`
  - [ ] Add test cases for new timelog types
  - [ ] Add test cases for `whole_day` flag
  - [ ] Test balance propagation on timelog changes

- [ ] **File: `src/components/TimelogForm.test.ts`**
  - [ ] Update snapshot/assertions for new fields
  - [ ] Add test cases for type selector
  - [ ] Add test cases for whole_day validation

- [ ] **Create: `src/stores/balances.test.ts`**
  - [ ] Test daily balance calculation
  - [ ] Test monthly aggregation
  - [ ] Test yearly aggregation
  - [ ] Test balance linking (next_balance_id, parent_balance_id)
  - [ ] Test cumulative_minutes calculation
  - [ ] Test special day counter aggregation

- [ ] **Create: `src/stores/timers.test.ts`**
  - [ ] Port tests from buttons.test.ts
  - [ ] Add tests for archived field

### 7.2 Integration Tests
- [ ] Test full balance calculation flow:
  - [ ] Create timelog → creates/updates daily balance → propagates to monthly → propagates to yearly
  - [ ] Delete timelog → recalculates affected balances
  - [ ] Update target → triggers balance recalculation
- [ ] Test sync flow for all new entities
- [ ] Test migration from old to new data structure

---

## 8. Documentation Updates

- [ ] **Update inline code comments**
  - [ ] Remove references to "MonthlyBalance" in comments
  - [ ] Update algorithm descriptions to match new design
  - [ ] Add JSDoc for new functions/methods

- [ ] **Update README** (if exists in frontend/)
  - [ ] Document new balance calculation approach
  - [ ] Document Target + TargetSpec relationship
  - [ ] Document timelog types

---

## 9. Performance Optimizations

- [ ] **Balance Calculation Optimization**
  - [ ] Implement incremental balance updates (as per design doc flowchart)
  - [ ] Add minute timer for active timelogs (only when viewing balance)
  - [ ] Optimize IndexedDB queries with proper indexes
  - [ ] Consider caching calculated balances in memory during session

- [ ] **Sync Optimization**
  - [ ] Batch balance syncs to backend
  - [ ] Only sync changed balances
  - [ ] Implement efficient conflict resolution

---

## 10. Migration Strategy

No migration needed!

---

## 11. Cleanup Tasks

- [ ] Remove deprecated files:
  - [ ] `src/stores/buttons.ts` (after migration to timers.ts)
  - [ ] `src/stores/monthly-balances.ts` (after migration to balances.ts)
  - [ ] Old component files after renaming
- [ ] Remove unused type definitions
- [ ] Remove dead code from old balance calculation
- [ ] Update `.gitignore` if needed
- [ ] Clean up console.log statements added during development

---

## 12. Final Verification

- [ ] Run all tests and ensure they pass
- [ ] Test app end-to-end with new structure
- [ ] Verify data syncs correctly with backend
- [ ] Verify balance calculations match expected results
- [ ] Test edge cases:
  - [ ] Multi-day timelogs
  - [ ] Timelogs spanning month boundaries
  - [ ] Multiple TargetSpecs for same Target
  - [ ] Whole-day special type timelogs
  - [ ] Balance recalculation after bulk import
- [ ] Performance testing with large datasets
- [ ] Cross-browser testing

---

## Priority Levels

**P0 (Critical - Blocking):**
- Type system updates (1.1, 1.2)
- Database migration (2.1)
- Core store updates (3.1, 3.2, 3.3, 3.4)

**P1 (High - Core Functionality):**
- Component updates (4.1, 4.2, 4.3, 4.4)
- Service layer updates (5.1, 5.2)
- Data migration script (10.1, 10.2)

**P2 (Medium - Important):**
- View updates (6.1, 6.2, 6.3)
- Testing (7.1, 7.2)
- Documentation (8)

**P3 (Low - Nice to Have):**
- Performance optimizations (9)
- Cleanup (11)
- Final verification (12)

---

## Notes

- This refactor touches almost every part of the frontend
- Consider doing this work in a feature branch with incremental commits
- Test thoroughly at each stage before proceeding
- The migration script is critical - test it extensively
- Consider adding feature flags to toggle between old/new systems during transition
- Backend API endpoints must be available before frontend can fully switch over