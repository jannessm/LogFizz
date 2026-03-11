<script lang="ts">
  import { dayjs, userTimezone } from '../../types';
  import { uses12HourClock, currentLocale } from '../../lib/dateFormatting';

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

  // Re-evaluate 12h detection whenever the locale store changes
  const is12Hour = $derived(uses12HourClock());

  // AM/PM state: derived from the current hour, toggleable by the user
  let isPM = $state(value ? value.hour() >= 12 : false);

  // Keep isPM in sync when the external value changes
  $effect(() => {
    if (value) {
      isPM = value.hour() >= 12;
    }
  });

  // Local text state for the date input field (locale-formatted)
  let dateInputText = $state('');
  let dateInputDirty = $state(false);

  // Keep dateInputText in sync with value when not being edited
  $effect(() => {
    // Re-run whenever locale changes
    const _locale = $currentLocale;
    if (!dateInputDirty) {
      if (isStringMode) {
        dateInputText = stringValue ? dayjs(stringValue).format('L') : '';
      } else if (value) {
        dateInputText = value.format('L');
      } else {
        dateInputText = '';
      }
    }
  });

  // Locale-aware date placeholder (e.g. "MM/DD/YYYY" or "DD.MM.YYYY")
  let datePlaceholder = $derived.by(() => {
    const _locale = $currentLocale;
    return dayjs('2001-12-31').format('L')
      .replace('2001', 'YYYY')
      .replace('31', 'DD')
      .replace('12', 'MM');
  });

  function handleDateInput(input: string) {
    dateInputText = input;
    dateInputDirty = true;
  }

  function commitDateInput() {
    dateInputDirty = false;
    const raw = dateInputText.trim();

    if (isStringMode) {
      if (!raw) {
        stringValue = null;
        return;
      }
      const parsed = dayjs(raw, 'L', true);
      if (parsed.isValid()) {
        stringValue = parsed.format('YYYY-MM-DD');
        dateInputText = parsed.format('L');
      } else {
        // Restore previous display value
        dateInputText = stringValue ? dayjs(stringValue).format('L') : '';
      }
    } else if (value) {
      if (!raw) return;
      const parsed = dayjs(raw, 'L', true);
      if (parsed.isValid()) {
        value = value.set('year', parsed.year()).set('month', parsed.month()).set('date', parsed.date());
        dateInputText = value.format('L');
      } else {
        // Restore previous display value
        dateInputText = value.format('L');
      }
    }
  }

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
      let [hours, minutes] = input.split(':').map(Number);
      if (is12Hour) {
        // Convert 12h display value back to 24h for internal storage
        if (isPM && hours < 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;
      }
      value = value.set('hour', hours).set('minute', minutes);
    }
  }

  function toggleAmPm() {
    if (!value || disabled || timeDisabled) return;
    isPM = !isPM;
    const currentHour = value.hour();
    let newHour: number;
    if (isPM) {
      // Switch to PM: add 12 unless already in PM range
      newHour = currentHour < 12 ? currentHour + 12 : currentHour;
    } else {
      // Switch to AM: subtract 12 unless already in AM range
      newHour = currentHour >= 12 ? currentHour - 12 : currentHour;
    }
    value = value.set('hour', newHour);
  }

  // For 12h mode the time input shows hours in 1–12 range
  let timeValue = $derived(() => {
    if (!value) return '';
    if (is12Hour) {
      const h = value.hour() % 12 || 12;
      const m = value.minute().toString().padStart(2, '0');
      return `${h.toString().padStart(2, '0')}:${m}`;
    }
    return value.format('HH:mm');
  });
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
      type="text"
      value={dateInputText}
      placeholder={datePlaceholder}
      oninput={(e) => handleDateInput(e.currentTarget.value)}
      onblur={commitDateInput}
      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitDateInput(); } }}
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
      <div class="flex gap-2">
        <input
          id={timeId}
          type="time"
          value={timeValue()}
          oninput={(e) => handleTimeChange(e.currentTarget.value)}
          disabled={disabled || timeDisabled}
          {required}
          class="flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          class:border-gray-300={!hasError}
          class:dark:border-gray-600={!hasError}
          class:border-red-500={hasError}
        />
        {#if is12Hour}
          <button
            type="button"
            onclick={toggleAmPm}
            disabled={disabled || timeDisabled}
            class="px-3 py-2 rounded-lg border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
            class:border-gray-300={!hasError}
            class:dark:border-gray-600={!hasError}
            class:border-red-500={hasError}
            aria-label={isPM ? 'PM' : 'AM'}
          >
            {isPM ? 'PM' : 'AM'}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>
