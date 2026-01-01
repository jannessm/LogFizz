<script lang="ts">
  import { onMount } from 'svelte';
  import { timers } from '../../stores/timers';
  import { dayjs, type TimeLog } from '../../types';
  import { userTimezone } from '../../../../lib/dist/utils/dayjs';

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

  let timerId = $state('');
  let timezone = userTimezone;
  let type = $state('normal');
  let isRunning = $state(false); // When stopping timer, it should not be running
  let isWholeDay = $state(false);
  
  // When editing, convert from stored timezone to user's local timezone
  // For new entries, use selectedDate and current time as defaults
  const now = dayjs.utc(selectedDate);
  
  // Initialize start timestamp
  let startTimestamp = $state(dayjs());

  // Initialize end timestamp - using a derived value to avoid the warning
  let endTimestamp = $state(dayjs());

  let notes = $state('');
  let errorMessage: string = $state('');
  let showDeleteConfirm = $state(false);

  onMount(() => {
    if (existingLog) {
      startTimestamp = !!existingLog.start_timestamp
        ? dayjs.utc(existingLog.start_timestamp)
        : now;

      endTimestamp = existingLog.end_timestamp
        ? dayjs.utc(existingLog.end_timestamp)
        : now;
      
      if (!existingLog.whole_day && endTimestamp.diff(startTimestamp) < 1000 * 60) {
        endTimestamp = startTimestamp.add(1, 'minute');
      }

      timerId = existingLog.timer_id || '';
      type = existingLog.type || 'normal';
      isRunning = !existingLog.end_timestamp && !isTimerStop; // When stopping timer, it should not be running
      isWholeDay = existingLog.whole_day || false;
      notes = existingLog.notes || '';
      timezone = existingLog.timezone || userTimezone;
    }
  })

  function setTimestamp(value: dayjs.Dayjs, input: string, type: 'start' | 'end') {
    if (input.includes(':')) {
      const [hours, minutes] = input.split(':').map(Number);
      value = value.tz(timezone).set('hour', hours).set('minutes', minutes);
    } else if (input.includes('-')) {
      const [year, month, date] = input.split('-').map(Number);
      value = value.tz(timezone).set('year', year).set('month', month - 1).set('date', date);
    }

    if (type === 'start') {
      startTimestamp = value.utc();
    } else {
      endTimestamp = value.utc();
    }
    console.log(`Set ${type} timestamp to:`, value.format());
  }

  function hasDateError() {
    return errorMessage === 'End time must be after start time' || errorMessage === 'Duration must be at least 1 minute';
  }

  function handleSubmit() {
    errorMessage = '';

    if (!timerId || !startTimestamp) {
      errorMessage = 'Please fill all required fields';
      return;
    }

    if (!isRunning && !isWholeDay) {
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
    save({
      timer_id: timerId,
      type,
      whole_day: isWholeDay,
      startTimestamp: startTimestamp.toISOString(),
      endTimestamp: endTimestamp.toISOString(),
      notes,
      existingLog
    });
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
    class="bg-white rounded-lg shadow-2xl w-full max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-gray-800">
          {#if isTimerStop}
            Stop Timer
          {:else}
            {existingLog ? 'Edit' : 'Add'} Time Entry
          {/if}
        </h2>
        <button
          onclick={close}
          class="text-gray-400 hover:text-gray-600 transition-colors icon-[si--close-circle-duotone]"
          style="width: 28px; height: 28px;"
          aria-label="Close"
        ></button>
      </div>
      {#if isTimerStop}
        <p class="text-sm text-gray-600 mt-2">
          Add notes or adjust end time (optional). Click "Save" to stop the timer or close to keep it running.
        </p>
      {/if}
    </div>

    <!-- Scrollable Content -->
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="overflow-y-auto flex-1 p-6 space-y-4">
      <!-- Timer Selection -->
      <div>
        <label for="timer" class="block text-sm font-medium text-gray-700 mb-1">
          Timer *
        </label>
        <select
          id="timer"
          bind:value={timerId}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        <label for="type" class="block text-sm font-medium text-gray-700 mb-1">
          Type *
        </label>
        <select
          id="type"
          bind:value={type}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        >
          <option value="normal">Normal</option>
          <option value="sick">Sick</option>
          <option value="holiday">Holiday</option>
          <option value="business-trip">Business Trip</option>
          <option value="child-sick">Child Sick</option>
        </select>
      </div>

      <!-- Entry Type (hide when stopping timer or for non-normal types) -->
      {#if !isTimerStop}
        <div>
          <label class="flex items-center gap-2">
            <input
              id="running"
              type="checkbox"
              bind:checked={isRunning}
              disabled={isWholeDay}
              onchange={() => {
                if (isRunning) {
                  errorMessage = '';
                }
              }}
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="text-sm font-medium text-gray-700">Running</span>
          </label>
        </div>
      {/if}

      <!-- Whole Day Checkbox -->
      <div>
        <label class="flex items-center gap-2">
          <input
            id="wholeDay"
            type="checkbox"
            bind:checked={isWholeDay}
            onchange={() => {
              if (isWholeDay) {
                isRunning = false;
                errorMessage = '';
                startTimestamp = startTimestamp.startOf('day');
                endTimestamp = startTimestamp.startOf('day');
              }
            }}
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span class="text-sm font-medium text-gray-700">Whole Day</span>
        </label>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">
            Start Date *
          </label>
          <input
            id="startDate"
            type="date"
            bind:value={
              () => startTimestamp.tz(timezone).format('YYYY-MM-DD'),
              (value) => {setTimestamp(startTimestamp, value, 'start')}
            }
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label for="startTime" class="block text-sm font-medium text-gray-700 mb-1">
            Start Time *
          </label>
          <input
            id="startTime"
            type="time"
            bind:value={
              () => startTimestamp.tz(timezone).format('HH:mm'),
              (value) => {setTimestamp(startTimestamp, value, 'start')}
            }
            disabled={isWholeDay}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            required
          />
        </div>
      </div>

        <!-- End Date and Time (shown when not running OR when stopping timer) -->
        {#if !isRunning || isTimerStop}
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="endDate" class="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <input
                id="endDate"
                type="date"
                bind:value={
                  () => endTimestamp.tz(timezone).format('YYYY-MM-DD'),
                  (value) => {setTimestamp(endTimestamp, value, 'end')}
                }
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                class:border-gray-300={!hasDateError}
                class:border-red-500={hasDateError}
                required
              />
            </div>
            <div>
              <label for="endTime" class="block text-sm font-medium text-gray-700 mb-1">
                End Time *
              </label>
              <input
                id="endTime"
                type="time"
              bind:value={
                () => endTimestamp.tz(timezone).format('HH:mm'),
                (value) => {setTimestamp(endTimestamp, value, 'end')}
              }
                disabled={isWholeDay}
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                class:border-gray-300={!hasDateError}
                class:border-red-500={hasDateError}
                required
              />
            </div>
          </div>
      {/if}

      <!-- Notes Field -->
      <div>
        <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          id="notes"
          bind:value={notes}
          rows="3"
          placeholder="Add any notes about this time entry..."
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
        ></textarea>
      </div>

      <!-- Actions -->
      {#if errorMessage}
        <div class="text-sm text-red-600">{errorMessage}</div>
      {/if}
      <div class="space-y-3 pt-4">
        <div class="flex gap-3">
          <button
            type="button"
            onclick={close}
            class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {isTimerStop ? 'Keep Running' : 'Cancel'}
          </button>
          <button
            type="submit"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isTimerStop ? 'Stop Timer' : (existingLog ? 'Update' : 'Add')} 
          </button>
        </div>
        
        <!-- Delete Button (only shown when editing) -->
        {#if existingLog}
          <button
            type="button"
            onclick={handleDeleteClick}
            class="w-full px-4 py-2 border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-400 transition-colors flex items-center justify-center gap-2"
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
      class="bg-white rounded-lg shadow-2xl w-full max-w-[400px] overflow-hidden flex flex-col"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 class="text-xl font-semibold text-gray-800">Delete Time Entry?</h3>
        <button
          onclick={handleDeleteCancel}
          class="text-gray-400 hover:text-gray-600 transition-colors icon-[si--close-circle-duotone]"
          style="width: 28px; height: 28px;"
          aria-label="Close"
        ></button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">
        <p class="text-gray-600">This action cannot be undone. Are you sure you want to delete this time entry?</p>
        <div class="flex gap-3">
          <button
            onclick={handleDeleteCancel}
            class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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
