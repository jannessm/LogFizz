<script lang="ts">
  import TimerSelectWithCreate from './TimerSelectWithCreate.svelte';
  import type { TimeLogType } from '../../../../lib/types';

  type EditableRow = {
    id: number;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    notes: string;
    project: string;
    type: TimeLogType;
    timerId: string;
    isValid: boolean;
    isSkipped: boolean;
    errorMsg?: string;
  };

  let {
    row,
    onUpdate,
    onToggleSkip,
  }: {
    row: EditableRow;
    onUpdate: (updates: Partial<EditableRow>) => void;
    onToggleSkip: () => void;
  } = $props();

  const typeOptions: { value: TimeLogType; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'sick', label: 'Sick' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'business-trip', label: 'Business Trip' },
    { value: 'child-sick', label: 'Child Sick' },
  ];

  function handleStartDateChange(event: Event) {
    const target = event.target as HTMLInputElement;
    onUpdate({ startDate: target.value });
  }

  function handleStartTimeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    onUpdate({ startTime: target.value });
  }

  function handleEndDateChange(event: Event) {
    const target = event.target as HTMLInputElement;
    onUpdate({ endDate: target.value });
  }

  function handleEndTimeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    onUpdate({ endTime: target.value });
  }

  function handleTypeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    onUpdate({ type: target.value as TimeLogType });
  }

  function handleNotesChange(event: Event) {
    const target = event.target as HTMLInputElement;
    onUpdate({ notes: target.value });
  }

  function handleTimerChange(newTimerId: string) {
    onUpdate({ timerId: newTimerId });
  }

  // Format date for input (YYYY-MM-DD)
  function formatDateForInput(dateStr: string): string {
    if (!dateStr) return '';
    // Try to parse and format as YYYY-MM-DD
    const match = dateStr.match(/(\d{4})-?(\d{2})-?(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    // Try DD.MM.YYYY format
    const euroMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (euroMatch) {
      return `${euroMatch[3]}-${euroMatch[2].padStart(2, '0')}-${euroMatch[1].padStart(2, '0')}`;
    }
    return dateStr;
  }

  // Format time for input (HH:MM)
  function formatTimeForInput(timeStr: string): string {
    if (!timeStr) return '';
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
    return timeStr;
  }

  let formattedStartDate = $derived(formatDateForInput(row.startDate));
  let formattedStartTime = $derived(formatTimeForInput(row.startTime));
  let formattedEndDate = $derived(formatDateForInput(row.endDate));
  let formattedEndTime = $derived(formatTimeForInput(row.endTime));
</script>

<tr 
  class="border-t border-gray-200 dark:border-gray-600 {!row.isValid ? 'bg-red-50 dark:bg-red-900/20' : ''} {row.isSkipped ? 'opacity-50' : ''}"
>
  <td class="px-2 py-2">
    <input
      type="checkbox"
      checked={row.isSkipped}
      onchange={onToggleSkip}
      class="rounded"
      title={row.isSkipped ? 'Include this row' : 'Skip this row'}
    />
  </td>
  <td class="px-2 py-2 text-gray-500 dark:text-gray-400">{row.id + 1}</td>
  <td class="px-2 py-2">
    <input
      type="date"
      value={formattedStartDate}
      onchange={handleStartDateChange}
      disabled={row.isSkipped}
      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
    />
  </td>
  <td class="px-2 py-2">
    <input
      type="time"
      value={formattedStartTime}
      onchange={handleStartTimeChange}
      disabled={row.isSkipped}
      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
    />
  </td>
  <td class="px-2 py-2">
    <input
      type="date"
      value={formattedEndDate}
      onchange={handleEndDateChange}
      disabled={row.isSkipped}
      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
    />
  </td>
  <td class="px-2 py-2">
    <input
      type="time"
      value={formattedEndTime}
      onchange={handleEndTimeChange}
      disabled={row.isSkipped}
      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
    />
  </td>
  <td class="px-2 py-2">
    <select
      value={row.type}
      onchange={handleTypeChange}
      disabled={row.isSkipped}
      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
    >
      {#each typeOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </td>
  <td class="px-2 py-2">
    <TimerSelectWithCreate
      value={row.timerId}
      onchange={handleTimerChange}
      placeholder="Select..."
    />
  </td>
  <td class="px-2 py-2">
    <input
      type="text"
      value={row.notes}
      oninput={handleNotesChange}
      disabled={row.isSkipped}
      placeholder="Notes..."
      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
    />
  </td>
  <td class="px-2 py-2">
    {#if row.isSkipped}
      <span class="text-gray-500 text-xs">Skipped</span>
    {:else if !row.isValid}
      <span class="text-red-600 dark:text-red-400 text-xs" title={row.errorMsg}>⚠️ Invalid</span>
    {:else if !row.timerId}
      <span class="text-amber-600 dark:text-amber-400 text-xs">No timer</span>
    {:else}
      <span class="text-green-600 dark:text-green-400 text-xs">✓ Ready</span>
    {/if}
  </td>
</tr>
