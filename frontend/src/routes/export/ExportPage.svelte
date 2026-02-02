<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from '../../components/BottomNav.svelte';
  import TimelogsTable from '../../components/History/TimelogsTable.svelte';
  import TableFilters, { type FilterState } from '../../components/History/TableFilters.svelte';
  import { timeLogsStore, timerlogs } from '../../stores/timelogs';
  import { timers } from '../../stores/timers';
  import { targets } from '../../stores/targets';
  import { monthlyBalances } from '../../stores/balances';
  import { dayjs, type TimeLog } from '../../types';
  import { userTimezone } from '../../../../lib/utils/dayjs';
  import { navigate } from '../../lib/navigation';
  import { snackbar } from '../../stores/snackbar';
  import { calculateDueMinutes } from '../../../../lib/utils/balance';
  import { _ } from '../../lib/i18n';
  import { get } from 'svelte/store';

  // Column visibility state
  let visibleColumns = $state({
    timer: true,
    target: true,
    type: true,
    start: true,
    end: true,
    totalDuration: true,
    effectiveDuration: true,
    dueTime: true,
    diff: true,
    notes: true,
  });

  // Pagination
  const PAGE_SIZE = 100;
  let currentPage = $state(1);

  // Initialize filters from URL parameters
  function getInitialFilters(): FilterState {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    
    let dateFrom: dayjs.Dayjs | null = null;
    
    if (dateParam) {
      const parsed = dayjs(dateParam);
      if (parsed.isValid()) {
        dateFrom = parsed.startOf('month');
      }
    }
    
    return {
      dateFrom,
      dateTo: null,
      timerIds: [],
      targetIds: [],
      types: [],
      searchText: '',
    };
  }

  // Filters
  let filters = $state<FilterState>(getInitialFilters());

  // Track where we came from
  let returnPath = $state('/table');
  
  onMount(async () => {
    // Check if there's a 'from' query parameter
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    if (from === 'history') {
      returnPath = '/history';
    } else {
      returnPath = '/table';
    }
    
    // Load based on initial filter or current year by default
    await loadTimelogsForFilters();
    isLoading = false;
  });

  // Load all timelogs for the date range
  let isLoading = $state(true);

  // Load timelogs based on current filters
  async function loadTimelogsForFilters() {
    const startDate = filters.dateFrom || dayjs().startOf('year');
    const endDate = filters.dateTo || dayjs().endOf('year');
    
    // Calculate all months in the range
    let current = startDate.startOf('month');
    const end = endDate.startOf('month');
    
    const loadPromises = [];
    while (current.isSameOrBefore(end, 'month')) {
      loadPromises.push(timeLogsStore.loadLogsByYearMonth(current.year(), current.month() + 1));
      current = current.add(1, 'month');
    }
    
    await Promise.all(loadPromises);
  }

  // Watch for filter changes and reload data
  let previousDateFrom: dayjs.Dayjs | null = null;
  let previousDateTo: dayjs.Dayjs | null = null;
  
  $effect(() => {
    // Check if date filters changed
    const dateFromChanged = filters.dateFrom?.format('YYYY-MM-DD') !== previousDateFrom?.format('YYYY-MM-DD');
    const dateToChanged = filters.dateTo?.format('YYYY-MM-DD') !== previousDateTo?.format('YYYY-MM-DD');
    
    if (dateFromChanged || dateToChanged) {
      previousDateFrom = filters.dateFrom;
      previousDateTo = filters.dateTo;
      
      // Reload timelogs
      if (!isLoading) {
        loadTimelogsForFilters();
      }
    }
  });

  // Filter timelogs based on current filters
  let filteredTimelogs = $derived.by(() => {
    let logs = $timerlogs;

    // Date filter
    if (filters.dateFrom) {
      const fromDate = filters.dateFrom.startOf('day');
      logs = logs.filter(log => {
        const logDate = dayjs.utc(log.start_timestamp).tz(log.timezone || userTimezone);
        return logDate.isSameOrAfter(fromDate, 'day');
      });
    }

    if (filters.dateTo) {
      const toDate = filters.dateTo.endOf('day');
      logs = logs.filter(log => {
        const logDate = dayjs.utc(log.start_timestamp).tz(log.timezone || userTimezone);
        return logDate.isSameOrBefore(toDate, 'day');
      });
    }

    // Timer filter
    if (filters.timerIds.length > 0) {
      logs = logs.filter(log => filters.timerIds.includes(log.timer_id));
    }

    // Target filter (filter by timers that belong to selected targets)
    if (filters.targetIds.length > 0) {
      const timerIdsInTargets = $timers
        .filter(t => t.target_id && filters.targetIds.includes(t.target_id))
        .map(t => t.id);
      logs = logs.filter(log => timerIdsInTargets.includes(log.timer_id));
    }

    // Type filter
    if (filters.types.length > 0) {
      logs = logs.filter(log => filters.types.includes(log.type));
    }

    // Search filter
    if (filters.searchText.trim()) {
      const search = filters.searchText.toLowerCase().trim();
      logs = logs.filter(log => {
        // Search in notes
        if (log.notes?.toLowerCase().includes(search)) return true;
        
        // Search in timer name
        const timer = $timers.find(t => t.id === log.timer_id);
        if (timer?.name.toLowerCase().includes(search)) return true;
        
        // Search in target name
        if (timer?.target_id) {
          const target = $targets.find(t => t.id === timer.target_id);
          if (target?.name.toLowerCase().includes(search)) return true;
        }
        
        return false;
      });
    }

    // Sort by start_timestamp descending (newest first)
    return logs.sort((a, b) => 
      new Date(b.start_timestamp).getTime() - new Date(a.start_timestamp).getTime()
    );
  });

  // Paginated timelogs
  let paginatedTimelogs = $derived.by(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredTimelogs.slice(start, end);
  });

  let totalPages = $derived(Math.ceil(filteredTimelogs.length / PAGE_SIZE));

  // Reset to page 1 when filters change
  $effect(() => {
    // Reference filters to track changes
    const _ = filters;
    currentPage = 1;
  });

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  function handleCancel() {
    navigate(returnPath);
  }

  // Helper functions for CSV export
  function getTimerName(timerId: string): string {
    const timer = $timers.find(t => t.id === timerId);
    return timer ? (timer.emoji ? `${timer.emoji} ${timer.name}` : timer.name) : 'Unknown';
  }

  function getTargetName(timerId: string): string {
    const timer = $timers.find(t => t.id === timerId);
    if (!timer?.target_id) return '-';
    const target = $targets.find(t => t.id === timer.target_id);
    return target?.name || '-';
  }

  function formatDuration(minutes?: number): string {
    if (minutes === undefined) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  function getTotalDuration(timelog: TimeLog): number | undefined {
    if (!timelog.end_timestamp) return undefined;
    const start = dayjs(timelog.start_timestamp);
    const end = dayjs(timelog.end_timestamp);
    return end.diff(start, 'minute');
  }

  function getTimerId(timerId: string): string | undefined {
    const timer = $timers.find(t => t.id === timerId);
    return timer?.target_id;
  }

  function getDueTime(timelog: TimeLog): number | undefined {
    const targetId = getTimerId(timelog.timer_id);
    if (!targetId) return undefined;
    
    const target = $targets.find(t => t.id === targetId);
    if (!target) return undefined;
    
    const date = dayjs.utc(timelog.start_timestamp).tz(timelog.timezone || userTimezone).format('YYYY-MM-DD');
    return calculateDueMinutes(date, target as any, new Set());
  }

  function getDiff(timelog: TimeLog): number | undefined {
    const effective = timelog.duration_minutes;
    const due = getDueTime(timelog);
    if (effective === undefined || due === undefined) return undefined;
    return effective - due;
  }

  function formatDiff(minutes: number | undefined): string {
    if (minutes === undefined) return '';
    const isNegative = minutes < 0;
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    const sign = isNegative ? '-' : '+';
    return `${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  // Remove isolated Unicode symbols (emojis and special characters) from text
  function removeUnicodeSymbols(text: string): string {
    // Remove emojis and other Unicode symbols
    // Keep only ASCII and common Latin/European characters
    return text
      .replace(/[\p{So}\p{Sk}]/gu, '') // Remove symbols (other, modifier)
      .replace(/[\p{Cn}]/gu, '') // Remove unassigned characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
      .trim();
  }

  // Check if any column is selected for export
  let hasSelectedColumns = $derived(
    visibleColumns.timer || visibleColumns.target || visibleColumns.type ||
    visibleColumns.start || visibleColumns.end || visibleColumns.totalDuration ||
    visibleColumns.effectiveDuration || visibleColumns.dueTime || visibleColumns.diff || visibleColumns.notes
  );

  // Generate CSV content
  function generateCSV(): string {
    const logs = filteredTimelogs;
    if (logs.length === 0) return '';

    // Build header row
    const headers: string[] = [];
    if (visibleColumns.timer) headers.push('Timer');
    if (visibleColumns.target) headers.push('Target');
    if (visibleColumns.type) headers.push('Type');
    if (visibleColumns.start) headers.push('Start Date', 'Start Time');
    if (visibleColumns.end) headers.push('End Date', 'End Time');
    if (visibleColumns.totalDuration) headers.push('Total Duration');
    if (visibleColumns.effectiveDuration) headers.push('Effective Duration');
    if (visibleColumns.dueTime) headers.push('Due Time');
    if (visibleColumns.diff) headers.push('Diff');
    if (visibleColumns.notes) headers.push('Notes');

    // Build data rows
    const rows: string[][] = [];
    for (const log of logs) {
      const row: string[] = [];
      const logTimezone = log.timezone || userTimezone;
      const startDayjs = dayjs.utc(log.start_timestamp).tz(logTimezone);
      const endDayjs = log.end_timestamp ? dayjs.utc(log.end_timestamp).tz(logTimezone) : null;

      if (visibleColumns.timer) row.push(removeUnicodeSymbols(getTimerName(log.timer_id)).replace(/"/g, '""'));
      if (visibleColumns.target) row.push(removeUnicodeSymbols(getTargetName(log.timer_id)).replace(/"/g, '""'));
      if (visibleColumns.type) row.push(removeUnicodeSymbols(log.type));
      if (visibleColumns.start) {
        row.push(startDayjs.format('L'));
        row.push(startDayjs.format('LT'));
      }
      if (visibleColumns.end) {
        row.push(endDayjs ? endDayjs.format('L') : '');
        row.push(endDayjs ? endDayjs.format('LT') : '');
      }
      if (visibleColumns.totalDuration) row.push(formatDuration(getTotalDuration(log)));
      if (visibleColumns.effectiveDuration) row.push(formatDuration(log.duration_minutes));
      if (visibleColumns.dueTime) row.push(formatDuration(getDueTime(log)));
      if (visibleColumns.diff) row.push(formatDiff(getDiff(log)));
      if (visibleColumns.notes) row.push(removeUnicodeSymbols((log.notes || '')).replace(/"/g, '""').replace(/\n/g, ' '));

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
    if (!hasSelectedColumns) {
      snackbar.error(get(_)('export.selectColumnError'));
      return;
    }

    if (filteredTimelogs.length === 0) {
      snackbar.error(get(_)('export.noTimelogsError'));
      return;
    }

    try {
      const csv = generateCSV();
      
      // Create and download the file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with date range
      let filename = 'timelogs';
      if (filters.dateFrom && filters.dateTo) {
        const fromDate = filters.dateFrom.format('YYYY-MM-DD');
        const toDate = filters.dateTo.format('YYYY-MM-DD');
        filename = `timelogs_${fromDate}_to_${toDate}`;
      } else if (filters.dateFrom) {
        const fromDate = filters.dateFrom.format('YYYY-MM-DD');
        filename = `timelogs_from_${fromDate}`;
      } else if (filters.dateTo) {
        const toDate = filters.dateTo.format('YYYY-MM-DD');
        filename = `timelogs_until_${toDate}`;
      } else {
        const today = dayjs().format('YYYY-MM-DD');
        filename = `timelogs_${today}`;
      }
      link.download = `${filename}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      snackbar.success(get(_)('export.exportSuccess', { values: { count: filteredTimelogs.length } }));
    } catch (error) {
      snackbar.error(get(_)('export.exportError'));
      console.error('Export error:', error);
    }
  }

  // Toggle all columns
  function selectAllColumns() {
    visibleColumns = {
      timer: true,
      target: true,
      type: true,
      start: true,
      end: true,
      totalDuration: true,
      effectiveDuration: true,
      dueTime: true,
      diff: true,
      notes: true,
    };
  }

  function deselectAllColumns() {
    visibleColumns = {
      timer: false,
      target: false,
      type: false,
      start: false,
      end: false,
      totalDuration: false,
      effectiveDuration: false,
      dueTime: false,
      diff: false,
      notes: false,
    };
  }
</script>

<div class="min-h-screen bg-gray-100 dark:bg-gray-900 pb-20">
  <!-- Header -->
  <header class="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
    <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          onclick={handleCancel}
          class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          aria-label={$_('import.goBack')}
        >
          <span class="icon-[si--arrow-left-line]" style="width: 24px; height: 24px;"></span>
        </button>
        <h1 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{$_('export.title')}</h1>
      </div>
      <button
        onclick={handleExport}
        disabled={!hasSelectedColumns || filteredTimelogs.length === 0}
        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <span class="icon-[si--file-download-duotone]" style="width: 16px; height: 16px;"></span>
        {$_('export.exportCount', { values: { count: filteredTimelogs.length } })}
      </button>
    </div>
  </header>

  <!-- Main content -->
  <div class="max-w-7xl mx-auto px-4 py-4">
    <div class="flex flex-col gap-4">
      <!-- Filters -->
      <TableFilters
        bind:filters
        timers={$timers}
        targets={$targets}
      />

      <!-- Column Visibility -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
            {$_('export.columnsToExport')}
          </span>
          <div class="flex gap-2">
            <button
              onclick={selectAllColumns}
              class="text-xs text-blue-600 dark:text-orange-400 hover:underline"
            >
              {$_('export.selectAll')}
            </button>
            <span class="text-gray-400">|</span>
            <button
              onclick={deselectAllColumns}
              class="text-xs text-blue-600 dark:text-orange-400 hover:underline"
            >
              {$_('export.deselectAll')}
            </button>
          </div>
        </div>
        <div class="flex flex-wrap gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={visibleColumns.timer}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-200">{$_('export.timer')}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={visibleColumns.target}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-200">{$_('export.target')}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={visibleColumns.type}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-200">{$_('export.type')}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={visibleColumns.start}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-200">{$_('export.start')}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={visibleColumns.end}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-200">{$_('export.end')}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={visibleColumns.totalDuration}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-200">{$_('export.totalDuration')}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={visibleColumns.effectiveDuration}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-200">{$_('export.effectiveDuration')}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={visibleColumns.dueTime}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-200">{$_('export.dueTime')}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={visibleColumns.diff}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-200">{$_('export.difference')}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={visibleColumns.notes}
              class="w-4 h-4 text-blue-600 dark:text-orange-500 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-200">{$_('export.notes')}</span>
          </label>
        </div>
      </div>

      <!-- Results count and pagination info -->
      <div class="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
        <span>
          {filteredTimelogs.length} timelogs found
          {#if totalPages > 1}
            • Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredTimelogs.length)}
          {/if}
        </span>
        {#if totalPages > 1}
          <div class="flex items-center gap-2">
            <button
              onclick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {$_('common.previous')}
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onclick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {$_('common.next')}
            </button>
          </div>
        {/if}
      </div>

      <!-- Table -->
      <div class="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" style="max-height: calc(100vh - 400px);">
        {#if isLoading}
          <div class="flex items-center justify-center h-64">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        {:else}
          <TimelogsTable
            timelogs={paginatedTimelogs}
            timers={$timers}
            targets={$targets}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            {visibleColumns}
          />
        {/if}
      </div>

      <!-- Bottom pagination -->
      {#if totalPages > 1}
        <div class="flex justify-center items-center gap-2 text-sm">
          <button
            onclick={() => goToPage(1)}
            disabled={currentPage === 1}
            class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {$_('common.first')}
          </button>
          <button
            onclick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {$_('common.previous')}
          </button>
          
          {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
            return start + i;
          }).filter(p => p <= totalPages) as page}
            <button
              onclick={() => goToPage(page)}
              class="px-3 py-1 rounded border transition-colors"
              class:bg-primary={page === currentPage}
              class:text-white={page === currentPage}
              class:border-primary={page === currentPage}
              class:border-gray-300={page !== currentPage}
              class:dark:border-gray-600={page !== currentPage}
              class:hover:bg-gray-100={page !== currentPage}
              class:dark:hover:bg-gray-700={page !== currentPage}
            >
              {page}
            </button>
          {/each}
          
          <button
            onclick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {$_('common.next')}
          </button>
          <button
            onclick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {$_('common.last')}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<BottomNav currentTab={null} />
