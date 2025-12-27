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
- [x] **File: `src/types/index.ts`** ✅ COMPLETED
  - [x] Remove `Button` export, add `Timer` export
  - [x] Remove `DailyTarget` export, add `Target` export (with nested `target_specs` array - TargetSpec is not a separate entity for frontend)
  - [x] Remove `MonthlyBalance` export, add `Balance` export
  - [x] Verify all types are re-exported from `@clock/shared/types`

---

## 2. Database Layer (IndexedDB)

### 2.1 Database Schema Migration
- [x] **File: `src/lib/db/index.ts`** ✅ COMPLETED
  - [x] Rename `buttons` table to `timers`
  - [x] Rename `daily_targets` table to `targets`
  - [x] Rename `monthly_balances` table to `balances`
  - [x] Update indexes:
    - [x] Add index on `balances`: `[user_id, target_id, date]`

### 2.2 Update DB Functions
- [x] **File: `src/lib/db/index.ts`** ✅ COMPLETED
  - [x] Rename all `button` functions to `timer` (e.g., `getButton` → `getTimer`)
  - [x] Update `target` functions to work with new Target + TargetSpec structure
  - [x] Update balance functions:
    - [x] `getAllBalances()` - replaces `getAllMonthlyBalances()`
    - [x] `getBalancesByDate(date: string, granularity: 'daily' | 'monthly' | 'yearly')`
    - [x] `getBalancesByTargetId(targetId: string)`
    - [x] `saveBalance(balance: Balance)`
    - [x] `deleteBalance(id: string)`

---

## 3. Store Updates

### 3.1 Buttons → Timers Store
- [x] **File: `src/stores/timers.ts`** ✅ COMPLETED (CREATED NEW)
  - [x] Create new file `timers.ts` (renamed from `buttons.ts`)
  - [x] Update all references from `button` to `timer`
  - [x] Add `archived` field support
  - [x] Update sync service calls to use timer endpoints
  - [x] Update default values in `create()` method

- [x] **Update imports across codebase** ✅ COMPLETED
  - [x] Find all imports of `stores/buttons` and update to `stores/timers`
  - [x] Update variable names: `buttons` → `timers`, `button` → `timer` in components
  - [x] Delete old `src/stores/buttons.ts` file

### 3.2 Targets Store Refactor
- [x] **File: `src/stores/targets.ts`** ✅ COMPLETED
  - [x] Remove old `DailyTarget` references
  - [x] Update to use `Target` type with nested `target_specs` array
  - [x] Update `update()` method to handle embedded target_specs array updates
  - [x] Update `delete()` method (no cascade needed - target_specs are part of Target object)
  - [x] Update fields: Target now contains `target_spec_ids[]` reference and receives nested target_specs from backend
  - [x] Updated `todayTargets` derived store to check target_specs

### 3.3 Monthly Balances → Balances Store
- [x] **File: `src/stores/balances.ts`** ✅ COMPLETED (CREATED NEW)
  - [x] Create new file `balances.ts` (renamed from `monthly-balances.ts`)
  - [x] Remove dependency on removed `@clock/shared/monthlyBalance`
  - [x] Update to use `Balance` type instead of `MonthlyBalance`
  - [x] Implement new balance calculation flow from `lib/utils/balance.ts`:
    - [x] Use `calculateDueMinutes(date, target, holidays)`
    - [x] Use `calculateWorkedMinutesForDate(date, timelogs)`
    - [x] Use `aggregateToMonthly(dailyBalances, previousCumulation)`
    - [x] Use `aggregateToYearly(monthlyBalances, previousCumulation)`
  - [x] Remove old calculation methods
  - [x] Add new methods:
    - [x] `calculateDailyBalances(targetId, year, month)` - creates daily balances
    - [x] `calculateMonthlyBalance(targetId, year, month)` - aggregates to monthly
    - [x] `calculateYearlyBalance(targetId, year)` - aggregates to yearly
    - [x] `recalculateBalances(targetId?)` - full recalculation
    - [x] `getBalancesByGranularity(granularity: 'daily' | 'monthly' | 'yearly')`
  - [x] Add derived stores: `dailyBalances`, `monthlyBalances`, `yearlyBalances`
  - [x] Update fields in balance creation:
    - [x] Add `cumulative_minutes` calculation
    - [x] Add `worked_days` calculation
    - [x] Add special day counters: `sick_days`, `holidays`, `business_trip`, `child_sick`
  - [x] Delete old `src/stores/monthly-balances.ts` file

### 3.4 Timelogs Store Updates
- [x] **File: `src/stores/timelogs.ts`** ✅ COMPLETED
  - [x] Update references from `button_id` to `timer_id`
  - [x] Add support for new `type` field (`TimeLogType`)
  - [x] Add support for `whole_day` field
  - [x] Update `create()` and `update()` methods to include new fields
  - [x] Implement balance propagation on timelog changes
  - [x] Updated `startTimer(timerId)` method signature

---

## 4. Store Infrastructure Updates

### 4.1 Base Store Updates
- [x] **File: `src/stores/base-store.ts`** ✅ COMPLETED
  - [x] Update `SyncOperations` sync type: `'button' | 'timelog' | 'target' | 'monthlyBalance'` → `'timer' | 'timelog' | 'target' | 'balance'`

### 4.2 Sync Service Updates
- [x] **File: `src/services/sync.ts`** ✅ COMPLETED
  - [x] Update all sync configs to use new types
  - [x] Rename `queueUpsertButton` → `queueUpsertTimer`
  - [x] Rename `queueDeleteButton` → `queueDeleteTimer`
  - [x] Add `queueUpsertBalance` and `queueDeleteBalance` methods
  - [x] Update sync type filtering to use 'timer' instead of 'button'
  - [x] Update cursor key types: `'buttons' | 'monthlyBalances'` → `'timers' | 'balances'`

### 4.3 API Service Updates
- [x] **File: `src/services/api.ts`** ✅ COMPLETED
  - [x] Update imports to use `Timer` and `Balance` types
  - [x] Rename `buttonApi` → `timerApi`
  - [x] Update timer API endpoint: `/buttons` → `/timers`
  - [x] Rename `monthlyBalanceApi` → `balanceApi`
  - [x] Update balance API endpoint: `/monthly-balances` → `/balances`

### 4.4 Data Service Updates
- [x] **File: `src/services/data.ts`** ✅ COMPLETED
  - [x] Update imports: `buttonsStore` → `timersStore`
  - [x] Update imports: `balancesStore` from `stores/monthly-balances` → `stores/balances`

## 5. Component Updates (Step 4 - Next Phase)

### 5.1 Timer Components (formerly Button)
- [ ] **Rename components:**
  - [ ] `src/components/ButtonGrid.svelte` → `TimerGrid.svelte`
  - [ ] `src/components/ButtonForm.svelte` → `TimerForm.svelte`
  - [ ] Any other button-related component files

- [x] **Update component internals:** ✅ PARTIALLY COMPLETED
  - [x] Replace all `button` props/variables with `timer` (import statements done)
  - [x] Update store imports: `buttons` → `timers`
  - [ ] Add UI for `archived` field toggle (remaining)
  - [ ] Update form bindings in components (remaining)

### 5.2 Target Components
- [ ] **File: `src/components/TargetForm.svelte`**
  - [ ] Update form to handle Target with nested target_specs (backend returns joined data):
    - [ ] Separate sections for Target (name) and target_specs (schedule details)
    - [ ] Support multiple target_specs entries per Target
    - [ ] Add UI for `starting_from` and `ending_at` dates
  - [ ] Update validation logic for nested structure
  - [ ] Update submit handler to save Target with embedded target_specs array
  - [ ] Add ability to add/edit/delete target_specs within the Target object

- [ ] **File: `src/components/DailyTargets.svelte`**
  - [ ] Update to fetch and display Target with nested target_specs (already joined from backend)
  - [ ] Update display logic to show applicable target_spec for current date (filter from target.target_specs array)
  - [ ] Update references from `DailyTarget` to `Target`

### 5.3 Balance Components
- [x] **File: `src/components/History/MonthlyBalance.svelte`** ✅ PARTIALLY COMPLETED
  - [x] Updated to use new `Balance` type
  - [x] Updated imports to use `balanceApi` instead of `monthlyBalanceApi`
  - [x] Updated DB functions: `getBalancesByDate` instead of `getMonthlyBalancesByYearMonth`
  - [ ] Rename to `BalanceView.svelte` (supports all granularities) (remaining)
  - [ ] Add granularity selector: Daily / Monthly / Yearly (remaining)
  - [ ] Update displayed fields (partially done - shows `cumulative_minutes` instead of `balance_minutes`)

- [ ] **File: `src/components/DailyBalance.svelte`**
  - [ ] Update to use new `Balance` type with `date` field
  - [ ] Update calculation to use lib utilities
  - [ ] Add support for displaying special day types
  - [ ] Update styling to differentiate balance types

### 5.4 Timelog Components
- [ ] **File: `src/components/TimelogForm.svelte`**
  - [ ] Update `button_id` to `timer_id` (remaining - form bindings not updated)
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

## 6. View/Page Updates (Step 4 - Next Phase)

### 6.1 History View
- [ ] **File: `src/routes/history/+page.svelte`**
  - [ ] Update to use new balance components
  - [ ] Add granularity toggle (daily/monthly/yearly view)
  - [ ] Update balance display to show new fields
  - [ ] Update recalculation trigger
  - [ ] Update timelog list to show `type` and `whole_day` indicators

### 6.2 Dashboard View
- [ ] **File: `src/routes/+page.svelte`**
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
- [x] **File: `src/services/api.test.ts`** ✅ COMPLETED
  - [x] Updated tests to verify `timerApi` instead of `buttonApi`
  - [x] Updated tests to verify `balanceApi` endpoints

- [ ] **File: `src/stores/timelogs.test.ts`**
  - [x] Updated test cases for `timer_id` instead of `button_id` ✅
  - [ ] Add test cases for new timelog types
  - [ ] Add test cases for `whole_day` flag
  - [ ] Test balance propagation on timelog changes

- [ ] **File: `src/components/TimelogForm.test.ts`**
  - [x] Updated snapshot/assertions to use `timer_id` ✅
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
  - [ ] Test basic timer CRUD operations
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
  - [ ] Document Target with nested target_specs structure
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

No migration needed! ✅
- Database schema migration handled by IndexedDB version bump (2 → 3)
- Old stores deleted and replaced with new ones

---

## 11. Cleanup Tasks

- [x] Remove deprecated files: ✅ COMPLETED
  - [x] `src/stores/buttons.ts` (migrated to timers.ts)
  - [x] `src/stores/monthly-balances.ts` (migrated to balances.ts)
- [ ] Remove unused type definitions (remaining)
- [ ] Remove dead code from old balance calculation (remaining)
- [ ] Update `.gitignore` if needed
- [ ] Clean up console.log statements added during development

---

## 12. Final Verification

- [x] Build passes successfully ✅
- [x] TypeScript type checking passes ✅
- [x] 77 of 85 tests pass (8 failures due to Step 4 component updates) ✅
- [ ] Run all tests with 100% pass rate (requires Step 4)
- [ ] Test app end-to-end with new structure
- [ ] Verify data syncs correctly with backend
- [ ] Verify balance calculations match expected results
- [ ] Test edge cases:
  - [ ] Multi-day timelogs
  - [ ] Timelogs spanning month boundaries
  - [ ] Multiple target_specs entries within same Target (nested array)
  - [ ] Whole-day special type timelogs
  - [ ] Balance recalculation after bulk import
- [ ] Performance testing with large datasets
- [ ] Cross-browser testing

---

## Progress Summary

### Steps 1-3: COMPLETED ✅
- Type System Updates (Step 1): 100% complete
- Database Layer Updates (Step 2): 100% complete
- Store Updates (Step 3): 100% complete
- Service Layer Updates (Part of Step 3): 100% complete

### Step 4: IN PROGRESS 🔄
- Component Updates: ~30% complete (imports updated, some form bindings remain)
- Test Updates: ~50% complete (API tests done, component tests need updating)
- Component form bindings: Need to update button_id → timer_id in form submissions

### Steps 5+: NOT STARTED
- View/Page Updates (Step 5)
- Documentation (Step 6)
- Performance Optimizations (Step 7)
- Final Verification (Step 8)

### Build & Test Status
- ✅ Build: Passing (no errors or warnings about missing types)
- ✅ TypeScript: Passing (no type errors)
- ✅ Tests: 77/85 passing (91% pass rate - 8 failures in component tests for Step 4)

---

## Notes

- **Step 1-3 Status**: All core infrastructure complete. Types, database, and stores fully refactored.
- **Component Updates**: Imports have been batch-updated to use new stores. Form bindings and component logic still need updates in Step 4.
- **Testing**: Core API and infrastructure tests updated. Component tests need timelog form updates.
- **Build**: Application builds successfully with all new changes integrated.
- **Next Steps**: Focus on Step 4 (Component Updates) to complete form bindings and UI updates, then Step 5+ for final integration and testing.