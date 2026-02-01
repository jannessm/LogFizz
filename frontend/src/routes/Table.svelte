<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import TimelogsTable from '../components/History/TimelogsTable.svelte';
  import TableFilters, { type FilterState } from '../components/History/TableFilters.svelte';
  import { timeLogsStore, timerlogs } from '../stores/timelogs';
  import { timers } from '../stores/timers';
  import { targets } from '../stores/targets';
  import { monthlyBalances } from '../stores/balances';
  import { dayjs, type TimeLog } from '../types';
  import { userTimezone } from '../../../lib/utils/dayjs';
  import { navigate } from '../lib/navigation';
  import { _ } from '../lib/i18n';

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

  // Load all timelogs for the date range
  let isLoading = $state(true);

  onMount(async () => {
    // Load based on initial filter or current year by default
    await loadTimelogsForFilters();
    
    isLoading = false;
  });

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
      
      // Update URL
      updateURL();
      
      // Reload timelogs
      if (!isLoading) {
        loadTimelogsForFilters();
      }
    }
  });

  // Update URL with current filter state
  function updateURL() {
    const params = new URLSearchParams();
    if (filters.dateFrom) {
      params.set('date', filters.dateFrom.format('YYYY-MM-DD'));
    }
    
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
  }

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

  function handleExportClick() {
    // Navigate to export page with current date filter
    const params = new URLSearchParams();
    params.set('from', 'table');
    if (filters.dateFrom) {
      params.set('date', filters.dateFrom.format('YYYY-MM-DD'));
    }
    navigate(`/export?${params.toString()}`);
  }

  function navigateToHistory() {
    // Preserve the starting date parameter when navigating to history
    const params = new URLSearchParams();
    if (filters.dateFrom) {
      params.set('date', filters.dateFrom.format('YYYY-MM-DD'));
      params.set('month', filters.dateFrom.format('YYYY-MM'));
    }
    
    const path = params.toString() ? `/history?${params.toString()}` : '/history';
    navigate(path);
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }
</script>

<div class="flex flex-col h-screen">
  <!-- Header -->
  <div class="w-full px-4 pt-6 pb-2">
    <div class="w-full max-w-7xl mx-auto flex justify-between items-center">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">{$_('table.title')}</h1>
      <div class="flex gap-1 items-center">
        <button
          onclick={navigateToHistory}
          class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors icon-[proicons--calendar] text-gray-600 dark:text-gray-400"
          style="width: 28px; height: 28px;"
          aria-label="Calendar view"
        ></button>
        <button
          onclick={handleExportClick}
          class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors icon-[si--file-upload-duotone] text-gray-600 dark:text-gray-400"
          style="width: 28px; height: 28px;"
          aria-label="Export timelogs"
        ></button>
        <button
          onclick={() => navigate('/import?from=table')}
          class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors icon-[si--file-download-duotone] text-gray-600 dark:text-gray-400"
          style="width: 28px; height: 28px;"
          aria-label="Import timelogs"
        ></button>
      </div>
    </div>
  </div>

  <!-- Main content -->
  <div class="flex-1 overflow-hidden px-4 pb-4">
    <div class="max-w-7xl mx-auto h-full flex flex-col gap-4">
      <!-- Filters -->
      <TableFilters
        bind:filters
        timers={$timers}
        targets={$targets}
      />

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
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onclick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        {/if}
      </div>

      <!-- Table -->
      <div class="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {#if isLoading}
          <div class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        {:else}
          <TimelogsTable
            timelogs={paginatedTimelogs}
            timers={$timers}
            targets={$targets}
            monthlyBalances={$monthlyBalances}
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
            First
          </button>
          <button
            onclick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Previous
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
            Next
          </button>
          <button
            onclick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Last
          </button>
        </div>
      {/if}
    </div>
  </div>

  <BottomNav currentTab={null} />
</div>
