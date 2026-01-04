<script lang="ts">
  import BottomNav from '../components/BottomNav.svelte';
  import DailyBalance from '../components/DailyBalance.svelte';

  import {
    HistoryCharts, HistoryCalendar,
    HistoryLogs, MonthlyBalance, ImportTimelogsModal
  } from '../components/History';
  import { timeLogsStore } from '../stores/timelogs';
  import { timers } from '../stores/timers';
  import { targets } from '../stores/targets';
  import { snackbar } from '../stores/snackbar';
  import { dayjs, type TimeLog } from '../types'; // ensure consistent dayjs instance
  import { onMount } from 'svelte';
  import { createCalendarStore, loadCalendarMonth } from '../services/calendar';

  let selectedDate = $state(dayjs()); // actual selected date, updates daily details view
  let currentMonth = $state(dayjs());  // month being viewed in calendar, updates yearly/monthly balance views
  let showImportModal = $state(false);

  // Create calendar store that reactively updates based on currentMonth and timers
  let calendarStore = $derived(
    createCalendarStore(currentMonth.year(), currentMonth.month() + 1, 1, $timers)
  );
  let calendarData = $derived($calendarStore);

  onMount(async () => {
    // Load initial month range on mount
    await loadCalendarMonth(currentMonth.year(), currentMonth.month() + 1);
  });

  // Handle date changes from the calendar
  function handleDateChange(newSelectedDate: dayjs.Dayjs, newCurrentMonth: dayjs.Dayjs) {
    const monthChanged = !currentMonth.isSame(newCurrentMonth, 'month');
    selectedDate = newSelectedDate;
    currentMonth = newCurrentMonth;
    
    if (monthChanged) {
      loadCalendarMonth(currentMonth.year(), currentMonth.month() + 1);
    }
  }

  // Handle date selection from charts (only changes selected date, not the current month)
  function selectDate(date: dayjs.Dayjs) {
    selectedDate = date;
  }

  // Get unique state codes from all daily targets (for HistoryLogs component)
  function getTargetCountries(): string[] {
    const countries: string[] = [];
    for (const t of $targets) {
      for (const spec of t.target_specs || []) {
        if (spec.state_code) {
          countries.push(spec.state_code);
        }
      }
    }
    return Array.from(new Set(countries)); // Remove duplicates
  }

  function handleImportClick() {
    showImportModal = true;
  }

  function handleImportClose() {
    showImportModal = false;
  }

  async function handleImportConfirm(data: { 
    timerId: string; 
    timelogs: Array<{ start_timestamp: string; end_timestamp: string; notes?: string; timer_id?: string }>; 
    skippedCount: number;
    hasProjectMappings?: boolean;
  }) {
    const { timerId, timelogs, skippedCount, hasProjectMappings } = data;
    
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
  <!-- Header spanning full width -->
  <div class="w-full px-4 pt-6 pb-2">
    <div class="w-full max-w-7xl mx-auto flex justify-between items-center">
      <h1 class="text-2xl font-bold text-gray-800">History</h1>
      <button
        onclick={handleImportClick}
        class="p-2 hover:bg-gray-200 rounded-lg transition-colors icon-[si--file-upload-duotone]"
        style="width: 28px; height: 28px;"
        aria-label="Import timelogs"
      ></button>
    </div>
  </div>

  <!-- Main content area with flex layout -->
  <div class="w-full flex-1 flex flex-col lg:flex-row overflow-y-auto min-h-0">
    
    <!-- Left section: Calendar + Monthly Balances -->
    <div class="w-full lg:w-1/2 flex flex-col px-4 py-4 min-h-full">
      <div class="w-full max-w-lg mx-auto flex flex-col">
        <!-- Calendar Component (now with built-in navigation) -->
        <HistoryCalendar
          timers={$timers}
          timeLogs={Array.from(calendarData.timeLogsByDate.values()).flat()}
          calendarData={calendarData}
          targets={$targets}
          onDateChange={handleDateChange}
        />

        <!-- Monthly Balance Component -->
        <MonthlyBalance
          year={currentMonth.year()}
          month={currentMonth.month() + 1}
        />

        <!-- Charts Component -->
        <!-- <HistoryCharts
          timers={$timers}
          {timeLogs}
          {currentMonth}
          dateSelect={selectDate}
        /> -->
      </div>
    </div>

    <!-- Right section: Daily Details -->
    <div class="w-full lg:w-1/2 flex flex-col px-4 py-4 bg-gray-100 lg:bg-gray-50 min-h-full">
      <div class="w-full max-w-lg mx-auto flex flex-col">
        <h2 class="text-xl font-bold text-gray-800 mb-4">
          {selectedDate.format('MMMM D, YYYY')}
        </h2>

        <!-- Daily Balance -->
        <DailyBalance />

        <!-- Daily Logs with Filter -->
        <!-- <HistoryLogs
          {selectedDate}
          {timeLogs}
          buttons={$timers}
          countries={getTargetCountries()}
        /> -->
      </div>
    </div>

  </div>

  <BottomNav currentTab="history" />

  <!-- Import Timelogs Modal -->
  {#if showImportModal}
    <ImportTimelogsModal
      close={handleImportClose}
      onimport={handleImportConfirm}
    />
  {/if}
</div>

