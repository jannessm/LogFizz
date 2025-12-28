<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import DailyBalance from '../components/DailyBalance.svelte';
  import TimelogForm from '../components/TimelogForm.svelte';
  import HistoryCharts from '../components/History/HistoryCharts.svelte';
  import HistoryCalendar from '../components/History/HistoryCalendar.svelte';
  import HistoryLogs from '../components/History/HistoryLogs.svelte';
  import MonthlyBalance from '../components/History/MonthlyBalance.svelte';
  import ImportTimelogsModal from '../components/History/ImportTimelogsModal.svelte';
  import { timeLogsStore } from '../stores/timelogs';
  import { timersStore, timers } from '../stores/timers';
  import { targetsStore, targets } from '../stores/targets';
  import { holidaysStore } from '../stores/holidays';
  import { snackbar } from '../stores/snackbar';
  import dayjs from 'dayjs';

  // Initialize from URL query parameters if available
  function getInitialDates() {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    const monthParam = params.get('month');
    
    let selected = dayjs();
    let current = dayjs();
    
    if (dateParam) {
      const parsed = dayjs(dateParam);
      if (parsed.isValid()) {
        selected = parsed;
      }
    }
    
    if (monthParam) {
      const parsed = dayjs(monthParam);
      if (parsed.isValid()) {
        current = parsed;
      }
    } else if (dateParam) {
      // If no month param but date param exists, set current month to selected date's month
      current = selected.startOf('month');
    }
    
    return { selected, current };
  }

  const initialDates = getInitialDates();
  let selectedDate = initialDates.selected;
  let currentMonth = initialDates.current;
  let showTimelogForm = false;
  let editingTimelog: any = null;
  let showDeleteConfirm = false;
  let deleteTarget: any = null;
  let showImportModal = false;

  // Update URL when dates change
  function updateURL() {
    const params = new URLSearchParams();
    params.set('date', selectedDate.format('YYYY-MM-DD'));
    params.set('month', currentMonth.format('YYYY-MM'));
    
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
  }

  $: timeLogs = $timeLogsStore.items.filter(tl => 
    dayjs(tl.start_timestamp).month() === currentMonth.month() && 
    dayjs(tl.start_timestamp).year() === currentMonth.year()
  );
  $: allTimers = $timers;
  $: allTargets = $targets;

  // Get unique state codes from all daily targets
  function getTargetCountries(): string[] {
    const countries: string[] = [];
    for (const t of allTargets) {
      for (const spec of t.target_specs || []) {
        if (spec.state_code) {
          countries.push(spec.state_code);
        }
      }
    }
    return Array.from(new Set(countries)); // Remove duplicates
  }

  // Sync holidays for all countries in targets
  async function syncHolidays() {
    const countries = getTargetCountries();
    if (countries.length === 0) {
      // Fallback to user's country from browser locale if no targets have state codes
      const locale = navigator.language || 'en-US';
      const country = locale.split('-')[1]?.toUpperCase() || 'US';
      countries.push(country);
    }
    
    const year = currentMonth.year();
    await holidaysStore.fetchHolidaysForStates(countries, year);
  }

  onMount(async () => {
    await Promise.all([
      timersStore.load(),
      targetsStore.load(),
    ]);

    await Promise.all([
      timeLogsStore.load(),
      timeLogsStore.loadActive(),
    ]);

    // Sync holidays for the initial month
    await syncHolidays();
  });

  // Sync holidays when the month/year changes
  $: if (currentMonth) {
    syncHolidays();
  }

  function previousMonth() {
    currentMonth = currentMonth.subtract(1, 'month');
  }

  function nextMonth() {
    currentMonth = currentMonth.add(1, 'month');
  }

  function goToToday() {
    currentMonth = dayjs();
    selectedDate = dayjs();
  }

  function changeMonth(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newMonth = parseInt(target.value);
    currentMonth = currentMonth.month(newMonth);
  }

  function changeYear(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newYear = parseInt(target.value);
    currentMonth = currentMonth.year(newYear);
  }

  // Generate month options (0-11 for dayjs)
  function getMonthOptions() {
    return [
      { value: 0, label: 'January' },
      { value: 1, label: 'February' },
      { value: 2, label: 'March' },
      { value: 3, label: 'April' },
      { value: 4, label: 'May' },
      { value: 5, label: 'June' },
      { value: 6, label: 'July' },
      { value: 7, label: 'August' },
      { value: 8, label: 'September' },
      { value: 9, label: 'October' },
      { value: 10, label: 'November' },
      { value: 11, label: 'December' }
    ];
  }

  // Generate year options (current year ± 5 years)
  function getYearOptions() {
    const currentYear = dayjs().year();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i);
    }
    return years;
  }

  $: monthOptions = getMonthOptions();
  $: yearOptions = getYearOptions();

  function selectDate(date: dayjs.Dayjs) {
    selectedDate = date;
  }

  // Watch for date changes and update URL
  $: if (selectedDate && currentMonth) {
    updateURL();
  }

  function handleAddTimelog() {
    editingTimelog = null;
    showTimelogForm = true;
  }

  function handleEditTimelog(session: any) {
    editingTimelog = session;
    showTimelogForm = true;
  }

  async function handleSaveTimelog(event: CustomEvent) {
    const { timer_id, type, startTimestamp, endTimestamp, notes, existingLog } = event.detail;
    
    if (existingLog && existingLog.log) {
      // Editing existing timelog session - update it
      await timeLogsStore.update(existingLog.log.id, {
        timer_id,
        type,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp || undefined,
        notes: notes || undefined,
      });
    } else {
      // Creating new timelog session
      await timeLogsStore.create({
        timer_id,
        type,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp || undefined,
        notes: notes || undefined,
      });
    }
    
    showTimelogForm = false;
    editingTimelog = null;
  }

  function handleCloseForm() {
    showTimelogForm = false;
    editingTimelog = null;
  }

  function confirmDelete(session: any) {
    deleteTarget = session;
    showDeleteConfirm = true;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    
    // Delete the timelog session
    if (deleteTarget.log) {
      await timeLogsStore.delete(deleteTarget.log);
    }
    
    showDeleteConfirm = false;
    deleteTarget = null;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
    deleteTarget = null;
  }

  function handleImportClick() {
    showImportModal = true;
  }

  function handleImportClose() {
    showImportModal = false;
  }

  async function handleImportConfirm(event: CustomEvent<{ 
    timerId: string; 
    timelogs: Array<{ start_timestamp: string; end_timestamp: string; notes?: string; timer_id?: string }>; 
    skippedCount: number;
    hasProjectMappings?: boolean;
  }>) {
    const { timerId, timelogs, skippedCount, hasProjectMappings } = event.detail;
    
    // Create all timelogs concurrently for better performance
    const createPromises = timelogs.map(log => 
      timeLogsStore.create({
        timer_id: log.timer_id || timerId, // Use timer_id from timelog if present (project mapping), otherwise use shared timerId
        start_timestamp: log.start_timestamp,
        end_timestamp: log.end_timestamp,
        notes: log.notes,
      })
    );
    
    await Promise.all(createPromises);
    
    showImportModal = false;
    
    // Show success message
    const successMessage = skippedCount > 0 
      ? `Successfully imported ${timelogs.length} timelogs. ${skippedCount} rows were skipped.`
      : `Successfully imported ${timelogs.length} timelogs.`;
    snackbar.success(successMessage);
  }
</script>

<div class="flex flex-col h-screen bg-gray-50">
  <!-- Make content take full width and be scrollable horizontally and vertically -->
  <div class="w-full px-4 py-6 flex-1 overflow-auto">
    <!-- Inner centered container to preserve original max-width layout -->
    <div class="w-full max-w-lg mx-auto">
      <!-- Header -->
      <div class="flex justify-between items-center mb-1">
        <h1 class="text-2xl font-bold text-gray-800">History</h1>
        <button
          on:click={handleImportClick}
          class="p-2 hover:bg-gray-200 rounded-lg transition-colors icon-[si--file-upload-duotone]"
          style="width: 28px; height: 28px;"
          aria-label="Import timelogs"
        ></button>
      </div>
    
    <DailyBalance />


    <div class="flex justify-between items-center mt-6 mb-6">
      <div class="flex items-center gap-2">
        <!-- Month Navigation -->
        <button
          on:click={previousMonth}
          class="p-2 hover:bg-gray-200 rounded-lg transition-colors icon-[si--chevron-left-alt-duotone]"
          aria-label="Previous month"
        ></button>
        
        <!-- Month Dropdown -->
        <select
          on:change={changeMonth}
          value={currentMonth.month()}
          class="text-lg text-gray-800 bg-transparent border border-gray-300 rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Select month"
        >
          {#each monthOptions as month}
            <option value={month.value}>{month.label}</option>
          {/each}
        </select>
        
        <!-- Year Dropdown -->
        <select
          on:change={changeYear}
          value={currentMonth.year()}
          class="text-lg text-gray-800 bg-transparent border border-gray-300 rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Select year"
        >
          {#each yearOptions as year}
            <option value={year}>{year}</option>
          {/each}
        </select>
        
        <button
          on:click={nextMonth}
          class="p-2 hover:bg-gray-200 rounded-lg transition-colors icon-[si--chevron-right-alt-duotone]"
          aria-label="Next month"
        ></button>
        
        <!-- Today Button -->
        <button
          on:click={goToToday}
          class="px-3 py-1 text-sm font-medium text-white hover:bg-blue-600 rounded-lg transition-colors"
          class:bg-blue-500={!selectedDate.isSame(dayjs(), 'day')}
          class:bg-gray-300={selectedDate.isSame(dayjs(), 'day')}
          disabled={selectedDate.isSame(dayjs(), 'day')}
          aria-label="Go to today"
        >
          Today
        </button>
      </div>
    </div>
    
    <!-- Monthly Balance Component -->
    <MonthlyBalance
      year={currentMonth.year()}
      month={currentMonth.month() + 1}
    />

    <!-- Charts Component -->
    <HistoryCharts
      buttons={allTimers}
      {timeLogs}
      {currentMonth}
      onDateSelect={selectDate}
    />


    <!-- Calendar Component -->
    <HistoryCalendar
      {currentMonth}
      {selectedDate}
      buttons={allTimers}
      {timeLogs}
      countries={getTargetCountries()}
      onSelectDate={selectDate}
    />

      <!-- Logs Component with Filter -->
      <HistoryLogs
        {selectedDate}
        {timeLogs}
        buttons={allTimers}
        countries={getTargetCountries()}
        onAddTimelog={handleAddTimelog}
        onEditTimelog={handleEditTimelog}
      />
    </div>
  </div>

  <BottomNav currentTab="history" />

  <!-- Timelog Form Modal -->
  {#if showTimelogForm}
    <TimelogForm
      {selectedDate}
      existingLog={editingTimelog}
      on:save={handleSaveTimelog}
      on:close={handleCloseForm}
      on:delete={(e) => {
        showTimelogForm = false;
        deleteTarget = e.detail.session;
        showDeleteConfirm = true;
      }}
    />
  {/if}

  <!-- Delete Confirmation Modal -->
  {#if showDeleteConfirm}
    <!-- Modal Overlay -->
    <div 
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      on:click={cancelDelete}
      on:keydown={(e) => e.key === 'Escape' && cancelDelete()}
      role="button"
      tabindex="0"
    >
      <!-- Modal Content -->
      <div 
        class="bg-white rounded-lg shadow-2xl w-full max-w-[400px] overflow-hidden flex flex-col"
        on:click|stopPropagation
        on:keydown|stopPropagation
        role="dialog"
        aria-modal="true"
        tabindex="-1"
      >
        <!-- Header -->
        <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 class="text-xl font-semibold text-gray-800">Delete Time Entry?</h3>
          <button
            on:click={cancelDelete}
            class="text-gray-400 hover:text-gray-600 transition-colors icon-[si--close-circle-duotone]"
            style="width: 28px; height: 28px;"
            aria-label="Close"
          ></button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6">
          <p class="text-gray-600">This action cannot be undone.</p>
          <div class="flex gap-3">
            <button
              on:click={cancelDelete}
              class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              on:click={handleDelete}
              class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Import Timelogs Modal -->
  {#if showImportModal}
    <ImportTimelogsModal
      on:close={handleImportClose}
      on:import={handleImportConfirm}
    />
  {/if}
</div>

<style>
  /* Add backdrop blur effect */
  div[role="button"] {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
