<script lang="ts">
  import { dayjs, type TimeLog, type Timer, type TimeLogType } from '../../types';
  import type { TargetWithSpecs } from '../../types';
  import { userTimezone } from '../../../../lib/utils/dayjs';
  import DateTimeInput from '../forms/DateTimeInput.svelte';

  let {
    timelogs = [],
    timers = [],
    targets = [],
    editMode = false,
    selectable = false,
    selectedIds = $bindable(new Set<string>()),
    showActions = true,
    onEdit = undefined,
    onDelete = undefined,
    onSave = undefined,
  }: {
    timelogs: TimeLog[];
    timers: Timer[];
    targets: TargetWithSpecs[];
    editMode?: boolean;
    selectable?: boolean;
    selectedIds?: Set<string>;
    showActions?: boolean;
    onEdit?: (timelog: TimeLog) => void;
    onDelete?: (timelog: TimeLog) => void;
    onSave?: (timelog: TimeLog) => void;
  } = $props();

  // Track which rows are being edited inline
  let editingRows = $state(new Map<string, Partial<TimeLog>>());

  const typeOptions: TimeLogType[] = ['normal', 'sick', 'holiday', 'business-trip', 'child-sick'];

  function getTimerName(timerId: string): string {
    const timer = timers.find(t => t.id === timerId);
    return timer ? `${timer.emoji || ''} ${timer.name}`.trim() : 'Unknown';
  }

  function getTargetName(timerId: string): string {
    const timer = timers.find(t => t.id === timerId);
    if (!timer?.target_id) return '-';
    const target = targets.find(t => t.id === timer.target_id);
    return target?.name || '-';
  }

  function formatDateTime(timestamp: string | undefined, tz: string): string {
    if (!timestamp) return '-';
    return dayjs.utc(timestamp).tz(tz).format('YYYY-MM-DD HH:mm');
  }

  function formatDuration(minutes: number | undefined): string {
    if (minutes === undefined) return 'Running';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  function getTypeLabel(type: TimeLogType): string {
    const labels: Record<TimeLogType, string> = {
      'normal': 'Normal',
      'sick': 'Sick',
      'holiday': 'Holiday',
      'business-trip': 'Business Trip',
      'child-sick': 'Child Sick',
    };
    return labels[type] || type;
  }

  function getTypeBadgeClass(type: TimeLogType): string {
    const classes: Record<TimeLogType, string> = {
      'normal': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'sick': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'holiday': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'business-trip': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'child-sick': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return classes[type] || '';
  }

  function toggleSelectAll() {
    if (selectedIds.size === timelogs.length) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(timelogs.map(t => t.id));
    }
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    selectedIds = newSet;
  }

  function startEditing(timelog: TimeLog) {
    editingRows.set(timelog.id, { ...timelog });
    editingRows = new Map(editingRows);
  }

  function cancelEditing(id: string) {
    editingRows.delete(id);
    editingRows = new Map(editingRows);
  }

  function saveEditing(id: string) {
    const edited = editingRows.get(id);
    if (edited && onSave) {
      onSave(edited as TimeLog);
    }
    editingRows.delete(id);
    editingRows = new Map(editingRows);
  }

  function updateEditingField(id: string, field: keyof TimeLog, value: any) {
    const current = editingRows.get(id);
    if (current) {
      editingRows.set(id, { ...current, [field]: value });
      editingRows = new Map(editingRows);
    }
  }
</script>

<div class="overflow-x-auto">
  <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
    <thead class="bg-gray-50 dark:bg-gray-800">
      <tr>
        {#if selectable}
          <th class="px-3 py-3 text-left">
            <input
              type="checkbox"
              checked={selectedIds.size === timelogs.length && timelogs.length > 0}
              onchange={toggleSelectAll}
              class="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
            />
          </th>
        {/if}
        <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timer</th>
        <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target</th>
        <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
        <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start</th>
        <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">End</th>
        <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
        <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
        {#if showActions || editMode}
          <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
        {/if}
      </tr>
    </thead>
    <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
      {#each timelogs as timelog (timelog.id)}
        {@const isEditing = editingRows.has(timelog.id)}
        {@const editData = editingRows.get(timelog.id)}
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
          {#if selectable}
            <td class="px-3 py-2">
              <input
                type="checkbox"
                checked={selectedIds.has(timelog.id)}
                onchange={() => toggleSelect(timelog.id)}
                class="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
              />
            </td>
          {/if}
          
          <!-- Timer -->
          <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
            {#if isEditing && editData}
              <select
                value={editData.timer_id}
                onchange={(e) => updateEditingField(timelog.id, 'timer_id', e.currentTarget.value)}
                class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {#each timers as timer}
                  <option value={timer.id}>{timer.emoji || ''} {timer.name}</option>
                {/each}
              </select>
            {:else}
              {getTimerName(timelog.timer_id)}
            {/if}
          </td>
          
          <!-- Target -->
          <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {getTargetName(isEditing && editData ? editData.timer_id || timelog.timer_id : timelog.timer_id)}
          </td>
          
          <!-- Type -->
          <td class="px-3 py-2 whitespace-nowrap">
            {#if isEditing && editData}
              <select
                value={editData.type}
                onchange={(e) => updateEditingField(timelog.id, 'type', e.currentTarget.value)}
                class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {#each typeOptions as type}
                  <option value={type}>{getTypeLabel(type)}</option>
                {/each}
              </select>
            {:else}
              <span class="px-2 py-1 text-xs font-medium rounded-full {getTypeBadgeClass(timelog.type)}">
                {getTypeLabel(timelog.type)}
              </span>
            {/if}
          </td>
          
          <!-- Start -->
          <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
            {#if isEditing && editData}
              {@const startTs = dayjs.utc(editData.start_timestamp).tz(editData.timezone || userTimezone)}
              <input
                type="datetime-local"
                value={startTs.format('YYYY-MM-DDTHH:mm')}
                onchange={(e) => {
                  const newTs = dayjs.tz(e.currentTarget.value, editData.timezone || userTimezone);
                  updateEditingField(timelog.id, 'start_timestamp', newTs.toISOString());
                }}
                class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            {:else}
              {formatDateTime(timelog.start_timestamp, timelog.timezone || userTimezone)}
            {/if}
          </td>
          
          <!-- End -->
          <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
            {#if isEditing && editData}
              {#if editData.end_timestamp}
                {@const endTs = dayjs.utc(editData.end_timestamp).tz(editData.timezone || userTimezone)}
                <input
                  type="datetime-local"
                  value={endTs.format('YYYY-MM-DDTHH:mm')}
                  onchange={(e) => {
                    const newTs = dayjs.tz(e.currentTarget.value, editData.timezone || userTimezone);
                    updateEditingField(timelog.id, 'end_timestamp', newTs.toISOString());
                  }}
                  class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              {:else}
                <span class="text-gray-400">Running</span>
              {/if}
            {:else}
              {formatDateTime(timelog.end_timestamp, timelog.timezone || userTimezone)}
            {/if}
          </td>
          
          <!-- Duration -->
          <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
            {formatDuration(timelog.duration_minutes)}
          </td>
          
          <!-- Notes -->
          <td class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
            {#if isEditing && editData}
              <input
                type="text"
                value={editData.notes || ''}
                oninput={(e) => updateEditingField(timelog.id, 'notes', e.currentTarget.value)}
                placeholder="Add notes..."
                class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            {:else}
              <span title={timelog.notes || ''}>{timelog.notes || '-'}</span>
            {/if}
          </td>
          
          <!-- Actions -->
          {#if showActions || editMode}
            <td class="px-3 py-2 whitespace-nowrap text-sm">
              {#if isEditing}
                <div class="flex gap-1">
                  <button
                    onclick={() => saveEditing(timelog.id)}
                    class="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                    title="Save"
                  >
                    <span class="icon-[si--check-line] w-4 h-4"></span>
                  </button>
                  <button
                    onclick={() => cancelEditing(timelog.id)}
                    class="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Cancel"
                  >
                    <span class="icon-[si--close-line] w-4 h-4"></span>
                  </button>
                </div>
              {:else}
                <div class="flex gap-1">
                  {#if editMode}
                    <button
                      onclick={() => startEditing(timelog)}
                      class="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                      title="Edit inline"
                    >
                      <span class="icon-[si--edit-detailed-duotone] w-4 h-4"></span>
                    </button>
                  {/if}
                  {#if onEdit}
                    <button
                      onclick={() => onEdit(timelog)}
                      class="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="Edit in form"
                    >
                      <span class="icon-[si--clipboard-check-alt-duotone] w-4 h-4"></span>
                    </button>
                  {/if}
                  {#if onDelete}
                    <button
                      onclick={() => onDelete(timelog)}
                      class="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      title="Delete"
                    >
                      <span class="icon-[si--bin-duotone] w-4 h-4"></span>
                    </button>
                  {/if}
                </div>
              {/if}
            </td>
          {/if}
        </tr>
      {:else}
        <tr>
          <td colspan={selectable ? 9 : 8} class="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
            No timelogs found
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
