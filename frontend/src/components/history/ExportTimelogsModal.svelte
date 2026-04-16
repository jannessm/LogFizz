<script lang="ts">
  import { timers } from '../../stores/timers';
  import { targets } from '../../stores/targets';
  import { timerlogs } from '../../stores/timelogs';
  import { dayjs, userTimezone } from '../../types';
  import type { Timer as TimerType } from '../../types';
  import { _ } from '../../lib/i18n';
  import { formatMinutesHHMM } from '../../../../lib/utils/timeFormat';

  let {
    close
  }: {
    close: () => void;
  } = $props();

  const errMessages = {
    oneTimer: $_('exportform.atLeastOneTimer'),
    oneColumn: $_('exportform.atLeastOneColumn'),
    noTimelogs: $_('exportform.noTimelogsFound'),
    exportFailed: $_('exportform.exportFailed'),
  };

  // State
  let selectedTimerIds = $state<Set<string>>(new Set());
  let selectedTargetIds = $state<Set<string>>(new Set());
  let isLoading = $state(false);
  let errorMessage = $state('');

  // Date range filter (optional)
  let startDate = $state('');
  let endDate = $state('');

  // Column selection - default all checked
  let columns = $state({
    startDate: true,
    startTime: true,
    endDate: true,
    endTime: true,
    timezone: true,
    duration: true,
    timer: true,
    type: true,
    notes: true,
  });

  // Derived: map target_id to timers
  let timersByTarget = $derived(() => {
    const map = new Map<string, TimerType[]>();
    for (const timer of $timers) {
      if (timer.target_id) {
        if (!map.has(timer.target_id)) {
          map.set(timer.target_id, []);
        }
        map.get(timer.target_id)!.push(timer);
      }
    }
    return map;
  });

  // Derived: timers without a target
  let timersWithoutTarget = $derived($timers.filter(t => !t.target_id));

  // Derived: count of selected timelogs to export
  let timelogsToExport = $derived(() => {
    if (selectedTimerIds.size === 0) return [];
    
    // Exclude active (running) timelogs — they have no end_timestamp
    let logs = $timerlogs.filter(log => selectedTimerIds.has(log.timer_id) && !!log.end_timestamp);
    
    // Apply date range filter if set
    if (startDate) {
      const start = dayjs(startDate).startOf('day');
      logs = logs.filter(log => dayjs(log.start_timestamp).isAfter(start) || dayjs(log.start_timestamp).isSame(start, 'day'));
    }
    if (endDate) {
      const end = dayjs(endDate).endOf('day');
      logs = logs.filter(log => dayjs(log.start_timestamp).isBefore(end) || dayjs(log.start_timestamp).isSame(end, 'day'));
    }
    
    return logs.sort((a, b) => 
      new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime()
    );
  });

  // Get timer by ID for display
  function getTimerName(timerId: string): string {
    const timer = $timers.find(t => t.id === timerId);
    return timer ? (timer.emoji ? `${timer.emoji} ${timer.name}` : timer.name) : 'Unknown';
  }

  // Toggle timer selection
  function toggleTimer(timerId: string) {
    const newSet = new Set(selectedTimerIds);
    if (newSet.has(timerId)) {
      newSet.delete(timerId);
    } else {
      newSet.add(timerId);
    }
    selectedTimerIds = newSet;
  }

  // Toggle target selection (selects/deselects all timers for that target)
  function toggleTarget(targetId: string) {
    const newTargetSet = new Set(selectedTargetIds);
    const newTimerSet = new Set(selectedTimerIds);
    const targetTimers = timersByTarget().get(targetId) || [];
    
    if (newTargetSet.has(targetId)) {
      // Deselect target and all its timers
      newTargetSet.delete(targetId);
      for (const timer of targetTimers) {
        newTimerSet.delete(timer.id);
      }
    } else {
      // Select target and all its timers
      newTargetSet.add(targetId);
      for (const timer of targetTimers) {
        newTimerSet.add(timer.id);
      }
    }
    
    selectedTargetIds = newTargetSet;
    selectedTimerIds = newTimerSet;
  }

  // Check if a target is fully selected
  function isTargetFullySelected(targetId: string): boolean {
    const targetTimers = timersByTarget().get(targetId) || [];
    if (targetTimers.length === 0) return false;
    return targetTimers.every(timer => selectedTimerIds.has(timer.id));
  }

  // Check if a target is partially selected
  function isTargetPartiallySelected(targetId: string): boolean {
    const targetTimers = timersByTarget().get(targetId) || [];
    if (targetTimers.length === 0) return false;
    const selectedCount = targetTimers.filter(timer => selectedTimerIds.has(timer.id)).length;
    return selectedCount > 0 && selectedCount < targetTimers.length;
  }

  // Select all timers
  function selectAllTimers() {
    selectedTimerIds = new Set($timers.map(t => t.id));
    selectedTargetIds = new Set($targets.map(t => t.id));
  }

  // Deselect all timers
  function deselectAllTimers() {
    selectedTimerIds = new Set();
    selectedTargetIds = new Set();
  }

  // Check if any column is selected for export
  let hasSelectedColumns = $derived(
    columns.startDate || columns.startTime || columns.endDate || columns.endTime || 
    columns.duration || columns.timer || columns.type || columns.notes || columns.timezone
  );

  // Generate CSV content
  function generateCSV(): string {
    const logs = timelogsToExport();
    if (logs.length === 0) return '';

    // Build header row
    const headers: string[] = [];
    if (columns.startDate) headers.push($_('table.startDate'));
    if (columns.startTime) headers.push($_('table.startTime'));
    if (columns.endDate) headers.push($_('table.endDate'));
    if (columns.endTime) headers.push($_('table.endTime'));
    if (columns.timezone) headers.push($_('table.timezone'));
    if (columns.duration) headers.push($_('table.duration'));
    if (columns.timer) headers.push($_('table.timer'));
    if (columns.type) headers.push($_('table.type'));
    if (columns.notes) headers.push($_('table.notes'));

    // Build data rows
    const rows: string[][] = [];
    for (const log of logs) {
      const row: string[] = [];
      const logTimezone = log.timezone || userTimezone;
      const startDayjs = dayjs.utc(log.start_timestamp).tz(logTimezone);
      const endDayjs = log.end_timestamp ? dayjs.utc(log.end_timestamp).tz(logTimezone) : null;

      if (columns.startDate) row.push(startDayjs.format('L'));
      if (columns.startTime) row.push(startDayjs.format('LT'));
      if (columns.endDate) row.push(endDayjs ? endDayjs.format('L') : '');
      if (columns.endTime) row.push(endDayjs ? endDayjs.format('LT') : '');
      if (columns.timezone) row.push(logTimezone);
      if (columns.duration) row.push(formatMinutesHHMM(log.duration_minutes));
      if (columns.timer) row.push(getTimerName(log.timer_id).replace(/"/g, '""'));
      if (columns.type) row.push(log.type);
      if (columns.notes) row.push((log.notes || '').replace(/"/g, '""').replace(/\n/g, ' '));

      rows.push(row);
    }

    // Escape values and join with semicolon (European CSV format)
    const escapeValue = (val: string) => {
      if (val.includes(';') || val.includes('"') || val.includes('\n')) {
        return `"${val}"`;
      }
      return val;
    };

    const csvLines = [
      headers.join(';'),
      ...rows.map(row => row.map(escapeValue).join(';'))
    ];

    return csvLines.join('\n');
  }

  // Handle export
  function handleExport() {
    if (selectedTimerIds.size === 0) {
      errorMessage = errMessages.oneTimer;
      return;
    }

    if (!hasSelectedColumns) {
      errorMessage = errMessages.oneColumn;
      return;
    }

    const logs = timelogsToExport();
    if (logs.length === 0) {
      errorMessage = errMessages.noTimelogs;
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      const csv = generateCSV();
      
      // Create and download the file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with date
      const today = dayjs().format('YYYY-MM-DD');
      link.download = `timelogs_${today}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      close();
    } catch (error) {
      errorMessage = errMessages.exportFailed;
      console.error('Export error:', error);
    } finally {
      isLoading = false;
    }
  }
</script>

<!-- Modal Overlay -->
<div 
  class="export-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
  onclick={close}
  onkeydown={(e) => e.key === 'Escape' && close()}
  role="button"
  tabindex="0"
>
  <!-- Modal Content -->
  <div 
    class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
      <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">
        {$_('export.exportTimelogs')}
      </h2>
      <button
        onclick={close}
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors icon-[si--close-circle-duotone]"
        style="width: 28px; height: 28px;"
        aria-label={$_('common.close')}
      ></button>
    </div>

    <!-- Content -->
    <div class="overflow-y-auto flex-1 p-6 dark:bg-gray-800 space-y-6">
      <!-- Error Message -->
      {#if errorMessage}
        <div class="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-800 dark:text-red-300 text-sm whitespace-pre-line">
          {errorMessage}
        </div>
      {/if}

      <!-- Timer Selection -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <span class="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {$_('export.selectTimers')}
          </span>
          <div class="flex gap-2">
            <button
              onclick={selectAllTimers}
              class="text-xs text-blue-600 dark:text-orange-400 hover:underline"
            >
              {$_('common.selectAll')}
            </button>
            <span class="text-gray-400 dark:text-gray-600">|</span>
            <button
              onclick={deselectAllTimers}
              class="text-xs text-blue-600 dark:text-orange-400 hover:underline"
            >
              {$_('common.deselectAll')}
            </button>
          </div>
        </div>
        
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-h-64 overflow-y-auto space-y-4">
          <!-- Targets with their timers -->
          {#each $targets as target}
            {@const targetTimers = timersByTarget().get(target.id) || []}
            {#if targetTimers.length > 0}
              <div class="space-y-2">
                <!-- Target header with checkbox -->
                <label class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 font-medium">
                  <input
                    type="checkbox"
                    checked={isTargetFullySelected(target.id)}
                    indeterminate={isTargetPartiallySelected(target.id)}
                    onchange={() => toggleTarget(target.id)}
                    class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
                  />
                  <span class="text-gray-800 dark:text-gray-100">📁 {target.name}</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">({targetTimers.length} {targetTimers.length === 1 ? $_('common.timer') : $_('common.timers')})</span>
                </label>
                
                <!-- Timers under this target (indented) -->
                <div class="ml-6 space-y-1">
                  {#each targetTimers as timer}
                    <label class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
                      <input
                        type="checkbox"
                        checked={selectedTimerIds.has(timer.id)}
                        onchange={() => toggleTimer(timer.id)}
                        class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
                      />
                      <span class="text-gray-700 dark:text-gray-200">
                        {timer.emoji ? timer.emoji + ' ' : ''}{timer.name}
                      </span>
                    </label>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}

          <!-- Timers without a target -->
          {#if timersWithoutTarget.length > 0}
            <div class="space-y-1">
              {#if $targets.some(t => (timersByTarget().get(t.id) || []).length > 0)}
                <div class="text-sm font-medium text-gray-600 dark:text-gray-400 p-2">
                  {$_('export.otherTimers')}
                </div>
              {/if}
              {#each timersWithoutTarget as timer}
                <label class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
                  <input
                    type="checkbox"
                    checked={selectedTimerIds.has(timer.id)}
                    onchange={() => toggleTimer(timer.id)}
                    class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
                  />
                  <span class="text-gray-700 dark:text-gray-200">
                    {timer.emoji ? timer.emoji + ' ' : ''}{timer.name}
                  </span>
                </label>
              {/each}
            </div>
          {/if}

          <!-- No timers message -->
          {#if $timers.length === 0}
            <p class="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
              {$_('export.noTimersFound')}
            </p>
          {/if}
        </div>
      </div>

      <!-- Date Range Filter (Optional) -->
      <div>
        <span class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          {$_('export.dateRangeOptional')}
        </span>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="start-date" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{$_('common.from')}</label>
            <input
              id="start-date"
              type="date"
              bind:value={startDate}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label for="end-date" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{$_('common.to')}</label>
            <input
              id="end-date"
              type="date"
              bind:value={endDate}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {$_('export.leaveEmptyExportAll')}
        </p>
      </div>

      <!-- Column Selection -->
      <div>
        <span class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          {$_('export.selectColumns')}
        </span>
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 grid grid-cols-2 gap-2">
          <label class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
            <input
              type="checkbox"
              bind:checked={columns.startDate}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-gray-700 dark:text-gray-200">{$_('export.startDate')}</span>
          </label>
          
          <label class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
            <input
              type="checkbox"
              bind:checked={columns.startTime}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-gray-700 dark:text-gray-200">{$_('export.startTime')}</span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
            <input
              type="checkbox"
              bind:checked={columns.endDate}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-gray-700 dark:text-gray-200">{$_('export.endDate')}</span>
          </label>
          
          <label class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
            <input
              type="checkbox"
              bind:checked={columns.endTime}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-gray-700 dark:text-gray-200">{$_('export.endTime')}</span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
            <input
              type="checkbox"
              bind:checked={columns.timezone}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-gray-700 dark:text-gray-200">{$_('export.timezone')}</span>
          </label>
          
          <label class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
            <input
              type="checkbox"
              bind:checked={columns.duration}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-gray-700 dark:text-gray-200">{$_('timelog.duration')}</span>
          </label>
          
          <label class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
            <input
              type="checkbox"
              bind:checked={columns.timer}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-gray-700 dark:text-gray-200">{$_('dashboard.timers')}</span>
          </label>
          
          <label class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
            <input
              type="checkbox"
              bind:checked={columns.type}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-gray-700 dark:text-gray-200">{$_('timelog.type')}</span>
          </label>
          
          <label class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 col-span-2">
            <input
              type="checkbox"
              bind:checked={columns.notes}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-gray-700 dark:text-gray-200">{$_('timelog.notes')}</span>
          </label>
        </div>
      </div>

      <!-- Preview Count -->
      {#if selectedTimerIds.size > 0}
        <div class="bg-blue-50 dark:bg-orange-900/30 border border-blue-200 dark:border-orange-700 rounded-lg p-4">
          <p class="text-blue-700 dark:text-orange-200">
            <strong>{timelogsToExport().length}</strong> {$_('export.timelogsWillBeExported')} 
            <strong>{selectedTimerIds.size}</strong> {$_('common.selected')} {selectedTimerIds.size !== 1 ? $_('common.timers') : $_('common.timer')}
          </p>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t border-gray-200 dark:border-gray-600 flex justify-end gap-3">
      <button
        onclick={close}
        class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
      >
        {$_('common.cancel')}
      </button>
      <button
        onclick={handleExport}
        disabled={selectedTimerIds.size === 0 || !hasSelectedColumns || isLoading}
        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {#if isLoading}
          <span class="icon-[svg-spinners--ring-resize]" style="width: 16px; height: 16px;"></span>
        {:else}
          <span class="icon-[si--file-download-duotone]" style="width: 16px; height: 16px;"></span>
        {/if}
        {$_('export.export')} {timelogsToExport().length} {$_('common.timelogs')}
      </button>
    </div>
  </div>
</div>

<style>
  /* Add backdrop blur effect to modal overlay */
  .export-modal-backdrop {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
