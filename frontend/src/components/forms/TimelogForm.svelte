<script lang="ts">
  import { onMount } from 'svelte';
  import { timers } from '../../stores/timers';
  import { dayjs, type TimeLog } from '../../types';
  import { userTimezone } from '../../../../lib/utils/dayjs';

  let {
    selectedDate,
    existingLog = undefined,
    isTimerStop = false,
    save,
    close,
    del
  }: {
    selectedDate: dayjs.Dayjs;
    existingLog?: TimeLog;
    isTimerStop?: boolean;
    save: (data: any) => void;
    close: () => void;
    del: (data: any) => void
  } = $props();

  // When editing, convert from stored timezone to user's local timezone
  // For new entries, use selectedDate and current time as defaults
  const now = $derived(dayjs.utc(selectedDate));

  let newLog: Partial<TimeLog> = $state({
    timer_id: '',
    type: 'normal',
    whole_day: false,
    apply_break_calculation: false,
    start_timestamp: now.toISOString(),
    end_timestamp: undefined,
    timezone: userTimezone,
    notes: ''
  });
  let isRunning = $derived(!newLog.end_timestamp); // When stopping timer, it should not be running
  
  // Initialize start timestamp
  let startTimestamp = $derived(newLog.start_timestamp ? dayjs.utc(newLog.start_timestamp).tz(newLog.timezone || userTimezone) : now);

  // Initialize end timestamp - using a derived value to avoid the warning
  let endTimestamp = $derived(newLog.end_timestamp ? dayjs.utc(newLog.end_timestamp).tz(newLog.timezone || userTimezone) : now);

  let errorMessage: string = $state('');
  let showDeleteConfirm = $state(false);

  // Check if the type requires whole_day flag (all special types except normal)
  let isSpecialType = $derived(newLog.type !== 'normal');

  // Auto-set whole_day when special type is selected
  $effect(() => {
    if (isSpecialType && !newLog.whole_day) {
      newLog.whole_day = true;
      newLog.end_timestamp = newLog.start_timestamp;
      errorMessage = '';
    }
  });

  $effect(() => {
    if (newLog.timer_id) {
      const timer = $timers.find(t => t.id === newLog.timer_id);
      if (timer && timer.auto_subtract_breaks) {
        newLog.apply_break_calculation = true;
      } else {
        newLog.apply_break_calculation = false;
      }
    }
  });

  onMount(() => {
    if (existingLog) {
      newLog = { ...existingLog };
      newLog.timezone = existingLog.timezone || userTimezone;

      if (isTimerStop) {
        // For stopping timer, set end time to now if not set
        newLog.end_timestamp = now.toISOString();
      }

      const _startTimestamp = dayjs.utc(newLog.start_timestamp).tz(newLog.timezone || userTimezone);
      const _endTimestamp = newLog.end_timestamp
        ? dayjs.utc(newLog.end_timestamp).tz(newLog.timezone || userTimezone)
        : undefined;

      if (!newLog.whole_day && _endTimestamp && _endTimestamp.diff(_startTimestamp) < 1000 * 60) {
        newLog.end_timestamp = _endTimestamp.add(1, 'minute').toISOString();
      }
    }
  })

  function setTimestamp(value: dayjs.Dayjs, input: string, type: 'start' | 'end') {
    if (input.includes(':')) {
      const [hours, minutes] = input.split(':').map(Number);
      value = value.set('hour', hours).set('minutes', minutes);
    } else if (input.includes('-')) {
      const [year, month, date] = input.split('-').map(Number);
      value = value.set('year', year).set('month', month - 1).set('date', date);
    }

    if (type === 'start') {
      newLog.start_timestamp = value.toISOString();
    } else {
      newLog.end_timestamp = value.toISOString();
    }
  }

  function hasDateError() {
    return errorMessage === 'End time must be after start time' || errorMessage === 'Duration must be at least 1 minute';
  }

  function handleSubmit() {
    errorMessage = '';

    if (!newLog.timer_id || !newLog.start_timestamp) {
      errorMessage = 'Please fill all required fields';
      return;
    }

    if (isRunning && !isTimerStop) {
      newLog.end_timestamp = undefined;
    }

    if (!isRunning && !newLog.whole_day) {
      const endTimestamp = dayjs(newLog.end_timestamp!).tz(newLog.timezone || userTimezone);
      
      // Validate end date is not before start date
      if (endTimestamp.isBefore(startTimestamp)) {
        errorMessage = 'End date must be after start date';
        return;
      }

      // Validate minimum duration of 1 minute
      const durationMs = endTimestamp.diff(startTimestamp);
      const durationMinutes = durationMs / (1000 * 60);
      if (durationMinutes < 1) {
        errorMessage = 'Duration must be at least 1 minute';
        return;
      }
    }

    // is not TimeLog type
    save(newLog);
  }

  function handleDeleteClick() {
    showDeleteConfirm = true;
  }

  function handleDeleteConfirm() {
    del(existingLog);
    showDeleteConfirm = false;
  }

  function handleDeleteCancel() {
    showDeleteConfirm = false;
  }
</script>

<!-- Modal Overlay -->
<div 
  class="fixed inset-0 z-50 flex items-center justify-center p-4"
  onclick={close}
  onkeydown={(e) => e.key === 'Escape' && close()}
  role="button"
  tabindex="0"
>
  <!-- Modal Content -->
  <div 
    class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex flex-col">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">
          {#if isTimerStop}
            Stop Timer
          {:else}
            {existingLog ? 'Edit' : 'Add'} Time Entry
          {/if}
        </h2>
        <button
          onclick={close}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors icon-[si--close-circle-duotone]"
          style="width: 28px; height: 28px;"
          aria-label="Close"
        ></button>
      </div>
      {#if isTimerStop}
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Add notes or adjust end time (optional). Click "Save" to stop the timer or close to keep it running.
        </p>
      {/if}
    </div>

    <!-- Scrollable Content -->
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="overflow-y-auto flex-1 p-6 space-y-4">
      <!-- Timer Selection -->
      <div>
        <label for="timer" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Timer *
        </label>
        <select
          id="timer"
          bind:value={newLog.timer_id}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
          required
        >
          <option value="">Select a timer</option>
          {#each $timers as timer}
            <option value={timer.id}>
              {timer.emoji ? timer.emoji + ' ' : ''}{timer.name}
            </option>
          {/each}
        </select>
      </div>

      <!-- Type Selection -->
      <div>
        <label for="type" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Type *
        </label>
        <select
          id="type"
          bind:value={newLog.type}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
          required
        >
          <option value="normal">Normal</option>
          <option value="sick">Sick</option>
          <option value="holiday">Holiday</option>
          <option value="business-trip">Business Trip</option>
          <option value="child-sick">Child Sick</option>
        </select>
        {#if isSpecialType}
          <p class="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
            <span>Special types (Sick, Holiday, Business Trip, Child Sick) require the "Whole Day" flag to be counted in balance calculations.</span>
          </p>
        {/if}
      </div>

      <!-- Entry Type (hide when stopping timer or for non-normal types) -->
      {#if !isTimerStop}
        <div>
          <label class="flex items-center gap-2">
            <input
              id="running"
              type="checkbox"
              bind:checked={isRunning}
              disabled={newLog.whole_day}
              onchange={() => {
                if (isRunning) {
                  errorMessage = '';
                }
              }}
              class="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
            />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Running</span>
          </label>
        </div>
      {/if}

      <!-- Whole Day Checkbox -->
      <div>
        <label class="flex items-center gap-2">
          <input
            id="wholeDay"
            type="checkbox"
            bind:checked={newLog.whole_day}
            disabled={isSpecialType}
            onchange={() => {
              if (newLog.whole_day) {
                newLog.end_timestamp = newLog.start_timestamp;
                errorMessage = '';
              }
            }}
            class="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Whole Day</span>
        </label>
        {#if isSpecialType}
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
            Required for special types to ensure proper balance calculation
          </p>
        {/if}
      </div>

      <!-- Apply Break Calculation Checkbox -->
      <div>
        <label class="flex items-center gap-2">
          <input
            id="applyBreakCalculation"
            type="checkbox"
            bind:checked={newLog.apply_break_calculation}
            class="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Apply Break Calculation</span>
        </label>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
          Automatically deduct breaks based on German labor law: 30 min for 6-9 hours, 45 min for 9+ hours
        </p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="startDate" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Start Date *
          </label>
          <input
            id="startDate"
            type="date"
            bind:value={
              () => startTimestamp.tz(newLog.timezone).format('YYYY-MM-DD'),
              (value) => {setTimestamp(startTimestamp, value, 'start')}
            }
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
            required
          />
        </div>
        <div>
          <label for="startTime" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Start Time *
          </label>
          <input
            id="startTime"
            type="time"
            bind:value={
              () => startTimestamp.tz(newLog.timezone).format('HH:mm'),
              (value) => {setTimestamp(startTimestamp, value, 'start')}
            }
            disabled={newLog.whole_day}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            required
          />
        </div>
      </div>

        <!-- End Date and Time (shown when not running OR when stopping timer) -->
        {#if !isRunning || isTimerStop}
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="endDate" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date *
              </label>
              <input
                id="endDate"
                type="date"
                bind:value={
                  () => endTimestamp.tz(newLog.timezone).format('YYYY-MM-DD'),
                  (value) => {setTimestamp(endTimestamp, value, 'end')}
                }
                class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                class:border-gray-300={!hasDateError}
                class:dark:border-gray-600={!hasDateError}
                class:border-red-500={hasDateError}
                required
              />
            </div>
            <div>
              <label for="endTime" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time *
              </label>
              <input
                id="endTime"
                type="time"
              bind:value={
                () => endTimestamp.tz(newLog.timezone).format('HH:mm'),
                (value) => {setTimestamp(endTimestamp, value, 'end')}
              }
                disabled={newLog.whole_day}
                class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                class:border-gray-300={!hasDateError}
                class:dark:border-gray-600={!hasDateError}
                class:border-red-500={hasDateError}
                required
              />
            </div>
          </div>
      {/if}

      <!-- Notes Field -->
      <div>
        <label for="notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notes
        </label>
        <textarea
          id="notes"
          bind:value={newLog.notes}
          rows="3"
          placeholder="Add any notes about this time entry..."
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical"
        ></textarea>
      </div>

      <!-- Actions -->
      {#if errorMessage}
        <div class="text-sm text-red-600 dark:text-red-400">{errorMessage}</div>
      {/if}
      <div class="space-y-3 pt-4">
        <div class="flex gap-3">
          <button
            type="button"
            onclick={close}
            class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {isTimerStop ? 'Keep Running' : 'Cancel'}
          </button>
          <button
            type="submit"
            class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            {isTimerStop ? 'Stop Timer' : (existingLog ? 'Update' : 'Add')} 
          </button>
        </div>
        
        <!-- Delete Button (only shown when editing) -->
        {#if existingLog}
          <button
            type="button"
            onclick={handleDeleteClick}
            class="w-full px-4 py-2 border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 dark:hover:border-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <span class="icon-[si--bin-duotone]" style="width: 20px; height: 20px;"></span>
            Delete Entry
          </button>
        {/if}
      </div>
    </form>
  </div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
  <div 
    class="fixed inset-0 z-[60] flex items-center justify-center p-4"
    onclick={handleDeleteCancel}
    onkeydown={(e) => e.key === 'Escape' && handleDeleteCancel()}
    role="button"
    tabindex="0"
  >
    <!-- Modal Content -->
    <div 
      class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-[400px] overflow-hidden flex flex-col"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div class="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
        <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">Delete Time Entry?</h3>
        <button
          onclick={handleDeleteCancel}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors icon-[si--close-circle-duotone]"
          style="width: 28px; height: 28px;"
          aria-label="Close"
        ></button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">
        <p class="text-gray-600 dark:text-gray-400">This action cannot be undone. Are you sure you want to delete this time entry?</p>
        <div class="flex gap-3">
          <button
            onclick={handleDeleteCancel}
            class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onclick={handleDeleteConfirm}
            class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Add backdrop blur effect */
  div[role="button"] {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
  
  /* Higher z-index for delete confirmation */
  div[role="button"]:has(+ div) {
    z-index: 60;
  }
</style>
