<script lang="ts">
  import { dayjs, userTimezone } from '../../types';

  let {
    value = $bindable(),
    stringValue = $bindable(),
    timezone = userTimezone,
    disabled = false,
    dateOnly = false,
    timeDisabled = false,
    required = false,
    dateLabel = 'Date',
    timeLabel = 'Time',
    dateId = '',
    timeId = '',
    hasError = false,
  }: {
    value?: dayjs.Dayjs;
    stringValue?: string | null;
    timezone?: string;
    disabled?: boolean;
    dateOnly?: boolean;
    timeDisabled?: boolean;
    required?: boolean;
    dateLabel?: string;
    timeLabel?: string;
    dateId?: string;
    timeId?: string;
    hasError?: boolean;
  } = $props();

  // Support both dayjs and string modes
  const isStringMode = $derived(stringValue !== undefined);

  function handleDateChange(input: string) {
    if (isStringMode) {
      stringValue = input || null;
    } else if (value && input.includes('-')) {
      const [year, month, date] = input.split('-').map(Number);
      value = value.set('year', year).set('month', month - 1).set('date', date);
    }
  }

  function handleTimeChange(input: string) {
    if (!isStringMode && value && input.includes(':')) {
      const [hours, minutes] = input.split(':').map(Number);
      value = value.set('hour', hours).set('minute', minutes);
    }
  }

  let dateValue = $derived(
    isStringMode 
      ? (stringValue || '') 
      : (value ? value.tz(timezone).format('YYYY-MM-DD') : '')
  );
  let timeValue = $derived(value ? value.tz(timezone).format('HH:mm') : '');
</script>

<div class="grid gap-4" class:grid-cols-2={!dateOnly} class:grid-cols-1={dateOnly}>
  <div>
    {#if dateLabel}
      <label for={dateId} class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {dateLabel} {#if required}*{/if}
      </label>
    {/if}
    <input
      id={dateId}
      type="date"
      value={dateValue}
      oninput={(e) => handleDateChange(e.currentTarget.value)}
      {disabled}
      {required}
      class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
      class:border-gray-300={!hasError}
      class:dark:border-gray-600={!hasError}
      class:border-red-500={hasError}
    />
  </div>
  {#if !dateOnly}
    <div>
      {#if timeLabel}
        <label for={timeId} class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {timeLabel} {#if required}*{/if}
        </label>
      {/if}
      <input
        id={timeId}
        type="time"
        value={timeValue}
        oninput={(e) => handleTimeChange(e.currentTarget.value)}
        disabled={disabled || timeDisabled}
        {required}
        class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
        class:border-gray-300={!hasError}
        class:dark:border-gray-600={!hasError}
        class:border-red-500={hasError}
      />
    </div>
  {/if}
</div>
