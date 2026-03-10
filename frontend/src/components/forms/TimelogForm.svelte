<script lang="ts">
  import { onMount } from 'svelte';
  import { timers } from '../../stores/timers';
  import { dayjs, type TimeLog } from '../../types';
  import { userTimezone } from '../../../../lib/utils/dayjs';
  import DateTimeInput from './DateTimeInput.svelte';
  import { _ } from '../../lib/i18n';

  // Build sorted list of IANA timezones, excluding Etc/* entries
  const timezones: string[] = Intl.supportedValuesOf('timeZone').filter(tz => !tz.startsWith('Etc/'));

  let timezoneSearch = $state('');
  let timezoneDropdownOpen = $state(false);
  let filteredTimezones = $derived(
    timezoneSearch
      ? timezones.filter(tz => tz.toLowerCase().includes(timezoneSearch.toLowerCase()))
      : timezones
  );
  let highlightedIndex = $state(-1);
  let dropdownRef: HTMLUListElement | undefined = $state(undefined);

  function selectTimezone(tz: string) {
    handleTimezoneChange(tz);
    timezoneSearch = '';
    timezoneDropdownOpen = false;
    highlightedIndex = -1;
  }

  function handleTimezoneKeydown(e: KeyboardEvent) {
    if (!timezoneDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        timezoneDropdownOpen = true;
        highlightedIndex = 0;
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, filteredTimezones.length - 1);
      scrollHighlightedIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
      scrollHighlightedIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredTimezones.length) {
        selectTimezone(filteredTimezones[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      timezoneDropdownOpen = false;
      timezoneSearch = '';
      highlightedIndex = -1;
    }
  }

  function scrollHighlightedIntoView() {
    requestAnimationFrame(() => {
      const el = dropdownRef?.querySelector('[data-highlighted="true"]');
      el?.scrollIntoView({ block: 'nearest' });
    });
  }

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

  const errMessages = {
    endBeforeStart: $_('timelogform.endBeforeStart'),
    minDuration: $_('timelogform.minDuration'),
    fillAll: $_('timelogform.fillAll')
  };

  // When editing, convert from stored timezone to user's local timezone
  // For new entries, use selectedDate and current time as defaults
  const now = $derived(dayjs.utc(selectedDate).tz(userTimezone));
  console.log(now.toISOString(), userTimezone);

  let newLog: Partial<TimeLog> = $state({
    timer_id: undefined,
    type: 'normal',
    whole_day: false,
    apply_break_calculation: false,
    start_timestamp: now.toISOString(),
    end_timestamp: undefined,
    timezone: userTimezone,
    notes: ''
  });
  let isRunning = $derived(!newLog.end_timestamp); // When stopping timer, it should not be running
  
  // Initialize start timestamp - mutable for binding
  let startTimestamp = $state(now);
  
  // Initialize end timestamp - mutable for binding
  let endTimestamp = $state(now);

  // Sync startTimestamp changes to newLog
  $effect(() => {
    newLog.start_timestamp = startTimestamp.toISOString();
  });

  // Sync endTimestamp changes to newLog (only if not running)
  $effect(() => {
    if (!isRunning || isTimerStop) {
      newLog.end_timestamp = endTimestamp.toISOString();
    }
  });

  let errorMessage: string = $state('');
  let showDeleteConfirm = $state(false);

  // Check if the type requires whole_day flag (all special types except normal and homeoffice, business-trip)
  let isSpecialType = $derived(!['normal', 'homeoffice', 'business-trip'].includes(newLog.type || 'normal'));

  // Auto-set whole_day when special type is selected
  $effect(() => {
    if (isSpecialType && !newLog.whole_day) {
      newLog.whole_day = true;
      newLog.end_timestamp = newLog.start_timestamp;
      endTimestamp = startTimestamp;
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

      const tz = newLog.timezone || userTimezone;
      startTimestamp = dayjs.utc(newLog.start_timestamp).tz(tz);

      if (isTimerStop) {
        // For stopping timer, set end time to now if not set
        newLog.end_timestamp = now.toISOString();
        endTimestamp = now;
      } else if (newLog.end_timestamp) {
        endTimestamp = dayjs.utc(newLog.end_timestamp).tz(tz);
      }

      const _startTimestamp = startTimestamp;
      const _endTimestamp = newLog.end_timestamp
        ? dayjs.utc(newLog.end_timestamp).tz(tz)
        : undefined;

      if (!newLog.whole_day && _endTimestamp && _endTimestamp.diff(_startTimestamp) < 1000 * 60) {
        newLog.end_timestamp = _endTimestamp.add(1, 'minute').toISOString();
        endTimestamp = _endTimestamp.add(1, 'minute');
      }
    }
  })

  function hasDateError() {
    return errorMessage === errMessages.endBeforeStart || errorMessage === errMessages.minDuration;
  }

  function handleSubmit() {
    errorMessage = '';

    if (!newLog.timer_id || !newLog.start_timestamp) {
      errorMessage = errMessages.fillAll;
      return;
    }

    if (isRunning && !isTimerStop) {
      newLog.end_timestamp = undefined;
    }

    if (!isRunning && !newLog.whole_day) {
      const endTs = dayjs(newLog.end_timestamp!).tz(newLog.timezone || userTimezone);
      
      // Validate end date is not before start date
      if (endTs.isBefore(startTimestamp)) {
        errorMessage = errMessages.endBeforeStart;
        return;
      }

      // Validate minimum duration of 1 minute
      const durationMs = endTs.diff(startTimestamp);
      const durationMinutes = durationMs / (1000 * 60);
      if (durationMinutes < 1) {
        errorMessage = errMessages.minDuration;
        return;
      }
    }

    // is not TimeLog type
    console.log('saving:', newLog);
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

  function handleTimezoneChange(newTz: string) {
    const oldTz = newLog.timezone || userTimezone;
    newLog.timezone = newTz;

    // Re-interpret the same wall-clock times in the new timezone
    startTimestamp = dayjs.utc(startTimestamp.format('YYYY-MM-DDTHH:mm:ss'), 'YYYY-MM-DDTHH:mm:ss').tz(newTz, true);
    newLog.start_timestamp = startTimestamp.toISOString();

    if (newLog.end_timestamp) {
      endTimestamp = dayjs.utc(endTimestamp.format('YYYY-MM-DDTHH:mm:ss'), 'YYYY-MM-DDTHH:mm:ss').tz(newTz, true);
      newLog.end_timestamp = endTimestamp.toISOString();
    }
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
            {$_('timelogform.stopTimer')}
          {:else}
            {existingLog ? $_('timelogform.editTimeEntry') : $_('timelogform.addTimeEntry')}
          {/if}
        </h2>
        <button
          onclick={close}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors icon-[si--close-circle-duotone]"
          style="width: 28px; height: 28px;"
          aria-label={$_('common.close')}
        ></button>
      </div>
      {#if isTimerStop}
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {$_('timelog.addNotesDescription')}
        </p>
      {/if}
    </div>

    <!-- Scrollable Content -->
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="overflow-y-auto flex-1 p-6 space-y-4">
      <!-- Timer Selection -->
      <div>
        <label for="timer" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {$_('timelog.timerRequired')}
        </label>
        <select
          id="timer"
          bind:value={newLog.timer_id}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
          required
        >
          <option value="">{$_('timelog.selectTimer')}</option>
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
          {$_('timelog.typeRequired')}
        </label>
        <select
          id="type"
          bind:value={newLog.type}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
          required
        >
          <option value="normal">{$_('timelog.typeNormal')}</option>
          <option value="homeoffice">{$_('timelog.typeHomeoffice')}</option>
          <option value="sick">{$_('timelog.typeSick')}</option>
          <option value="holiday">{$_('timelog.typeHoliday')}</option>
          <option value="business-trip">{$_('timelog.typeBusinessTrip')}</option>
          <option value="child-sick">{$_('timelog.typeChildSick')}</option>
        </select>
        {#if isSpecialType}
          <p class="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
            <span>{$_('timelog.specialTypesDescription')}</span>
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
              disabled={newLog.whole_day || (!!existingLog && !existingLog.end_timestamp && !isTimerStop)}
              onchange={() => {
                if (isRunning) {
                  errorMessage = '';
                }
              }}
              class="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
            />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{$_('common.running')}</span>
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
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{$_('timelog.wholeDay')}</span>
        </label>
        {#if isSpecialType}
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
            {$_('timelog.wholeDayRequired')}
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
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{$_('timelog.applyBreakCalculation')}</span>
        </label>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
          {$_('timelog.applyBreakCalcDescription')}
        </p>
      </div>

      <!-- Timezone Selector -->
      <div class="relative">
        <label for="timezone" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {$_('timelog.timezone')}
        </label>
        <input
          type="text"
          id="timezone"
          value={timezoneDropdownOpen ? timezoneSearch : (newLog.timezone || userTimezone)}
          onfocus={() => { timezoneDropdownOpen = true; timezoneSearch = ''; highlightedIndex = -1; }}
          oninput={(e) => { timezoneSearch = e.currentTarget.value; highlightedIndex = 0; }}
          onkeydown={handleTimezoneKeydown}
          placeholder={newLog.timezone || userTimezone}
          autocomplete="off"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
        />

        {#if timezoneDropdownOpen}
          <ul
            bind:this={dropdownRef}
            class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto"
            role="listbox"
          >
            {#each filteredTimezones as tz, i}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <li
                role="option"
                aria-selected={tz === (newLog.timezone || userTimezone)}
                data-highlighted={i === highlightedIndex}
                class="px-3 py-1.5 text-sm cursor-pointer
                  {i === highlightedIndex ? 'bg-primary/20 text-primary dark:text-primary' : ''}
                  {tz === (newLog.timezone || userTimezone) ? 'font-semibold' : ''}
                  hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                onclick={() => selectTimezone(tz)}
                onmouseenter={() => highlightedIndex = i}
              >
                {tz}
              </li>
            {:else}
              <li class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
                {$_('timelog.noTimezonesFound')}
              </li>
            {/each}
          </ul>
          <!-- Invisible backdrop to close dropdown on outside click -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div class="fixed inset-0 z-40" onclick={() => { timezoneDropdownOpen = false; timezoneSearch = ''; }}></div>
        {/if}
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {$_('timelog.changeTimezone')}
        </p>
      </div>

      <DateTimeInput
        bind:value={startTimestamp}
        timezone={newLog.timezone || userTimezone}
        timeDisabled={newLog.whole_day}
        required
        dateLabel={$_('timelogform.startDate')}
        timeLabel={$_('timelogform.startTime')}
        dateId="startDate"
        timeId="startTime"
      />

        <!-- End Date and Time (shown when not running OR when stopping timer) -->
        {#if !isRunning || isTimerStop}
          <DateTimeInput
            bind:value={endTimestamp}
            timezone={newLog.timezone || userTimezone}
            timeDisabled={newLog.whole_day}
            required
            dateLabel={$_('timelogform.endDate')}
            timeLabel={$_('timelogform.endTime')}
            dateId="endDate"
            timeId="endTime"
            hasError={hasDateError()}
          />
      {/if}

      <!-- Notes Field -->
      <div>
        <label for="notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {$_('timelog.notes')}
        </label>
        <textarea
          id="notes"
          bind:value={newLog.notes}
          rows="3"
          placeholder={$_('timelog.notesPlaceholder')}
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
            {isTimerStop ? $_('common.running') : $_('common.cancel')}
          </button>
          <button
            type="submit"
            class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            {$_('common.save')} 
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
            {$_('timelog.deleteEntry')}
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
        <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{$_('timelog.deleteTimeEntry')}</h3>
        <button
          onclick={handleDeleteCancel}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors icon-[si--close-circle-duotone]"
          style="width: 28px; height: 28px;"
          aria-label={$_('common.close')}
        ></button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">
        <p class="text-gray-600 dark:text-gray-400">{$_('timelog.deleteConfirmation')}</p>
        <div class="flex gap-3">
          <button
            onclick={handleDeleteCancel}
            class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {$_('common.cancel')}
          </button>
          <button
            onclick={handleDeleteConfirm}
            class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {$_('common.delete')}
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
