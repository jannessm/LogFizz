<script lang="ts">
  import dayjs from 'dayjs';
  import utc from 'dayjs/plugin/utc';
  import timezone from 'dayjs/plugin/timezone';
  import { timers } from '../../stores/timers';

  dayjs.extend(utc);
  dayjs.extend(timezone);

  // Get user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let {
    selectedDate,
    existingLog = null,
    isTimerStop = false,
    save,
    close,
    del
  }: {
    selectedDate: dayjs.Dayjs;
    existingLog: any;
    isTimerStop: boolean;
    save: (data: any) => void;
    close: () => void;
    del: (data: any) => void;
  } = $props();

  let buttonId = $derived(existingLog?.timer_id || '');
  let type = $derived(existingLog?.log?.type || 'normal');
  
  // When editing, convert from stored timezone to user's local timezone
  let startDate = $derived(existingLog?.startTime 
    ? dayjs.utc(existingLog.startTime).tz(userTimezone).format('YYYY-MM-DD') 
    : selectedDate.format('YYYY-MM-DD'));
  let startTime = $derived(existingLog?.startTime 
    ? dayjs.utc(existingLog.startTime).tz(userTimezone).format('HH:mm') 
    : '');

  // When stopping a timer, pre-populate end time with current time
  const now = dayjs();
  let endDate = $derived(existingLog?.endTime 
    ? dayjs.utc(existingLog.endTime).tz(userTimezone).format('YYYY-MM-DD') 
    : (isTimerStop ? now.format('YYYY-MM-DD') : selectedDate.format('YYYY-MM-DD')));
  let endTime = $derived(existingLog?.endTime 
    ? dayjs.utc(existingLog.endTime).tz(userTimezone).format('HH:mm') 
    : (isTimerStop ? now.format('HH:mm') : ''));

  let notes = $derived(existingLog?.log?.notes || '');
  let isRunning = $derived(!existingLog?.endTime && !isTimerStop); // When stopping timer, it should not be running
  let errorMessage: string = $state('');
  let showDeleteConfirm = $state(false);

  // When type changes, reset date range validation
  $effect(() => {
    if (type !== 'normal') {
      // For non-normal types, ensure endDate is set to at least startDate
      if (!endDate || endDate < startDate) {
        endDate = startDate;
      }
    }
  });

  function hasDateError() {
    return errorMessage === 'End time must be after start time';
  }

  const DAY_START_TIME = '00:00:00';
  const DAY_END_TIME = '23:59:59';

  function handleSubmit() {
    errorMessage = '';

    if (!buttonId || !startDate) {
      errorMessage = 'Please fill all required fields';
      return;
    }

    // For special types (non-normal), we don't need start/end times, but we need date range
    if (type !== 'normal') {
      if (!endDate) {
        errorMessage = 'Please provide an end date';
        return;
      }

      // Validate end date is not before start date
      if (endDate < startDate) {
        errorMessage = 'End date must be on or after start date';
        return;
      }

      // Use start of first day and end of last day for the range
      const startTimestamp = `${startDate}T${DAY_START_TIME}`;
      const endTimestamp = `${endDate}T${DAY_END_TIME}`;
      
      save({
        timer_id: buttonId,
        type,
        startTimestamp,
        endTimestamp,
        notes,
        existingLog
      });
      return;
    }

    // For normal type, validate time fields
    if (!startTime) {
      errorMessage = 'Please fill all required fields';
      return;
    }

    const startTimestamp = `${startDate}T${startTime}:00`;
    let endTimestamp: string | null = null;

    if (!isRunning) {
      if (!endDate || !endTime) {
        errorMessage = 'Please provide end date and time for paired entry';
        return;
      }
      endTimestamp = `${endDate}T${endTime}:00`;

      // Validate end is after start
      if (new Date(endTimestamp) <= new Date(startTimestamp)) {
        errorMessage = 'End time must be after start time';
        return;
      }
    } else {
      // ensure paired value is removed when running
      endTimestamp = null;
    }

    save({
      timer_id: buttonId,
      type,
      startTimestamp,
      endTimestamp,
      notes,
      existingLog
    });
  }

  function handleDeleteClick() {
    showDeleteConfirm = true;
  }

  function handleDeleteConfirm() {
    del({ session: existingLog });
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
          bind:value={buttonId}
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
      {#if !isTimerStop && type === 'normal'}
        <div>
          <label class="flex items-center gap-2">
            <input
              id="running"
              type="checkbox"
              bind:checked={isRunning}
              onchange={() => {
                if (isRunning) {
                  endDate = '';
                  endTime = '';
                  errorMessage = '';
                }
              }}
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="text-sm font-medium text-gray-700">Running</span>
          </label>
        </div>
      {/if}

      <!-- For special types, show date range -->
      {#if type !== 'normal'}
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">
              Start Date *
            </label>
            <input
              id="startDate"
              type="date"
              bind:value={startDate}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label for="endDate" class="block text-sm font-medium text-gray-700 mb-1">
              End Date *
            </label>
            <input
              id="endDate"
              type="date"
              bind:value={endDate}
              min={startDate}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>
        <p class="text-sm text-gray-500">
          Duration will be calculated based on your daily targets for each day in this range
        </p>
      {:else}
        <!-- Start Date and Time (for normal type) -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">
              Start Date *
            </label>
            <input
              id="startDate"
              type="date"
              bind:value={startDate}
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
              bind:value={startTime}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                bind:value={endDate}
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                bind:value={endTime}
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                class:border-gray-300={!hasDateError}
                class:border-red-500={hasDateError}
                required
              />
            </div>
          </div>
        {/if}
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
