<script lang="ts">
  import BottomNav from '../components/BottomNav.svelte';

  import {
    HistoryCharts, HistoryCalendar,
    HistoryLogs, ImportTimelogsModal
  } from '../components/History';
  import BalancesOverview from '../components/History/BalancesOverview.svelte';
  import { timeLogsStore } from '../stores/timelogs';
  import { timers } from '../stores/timers';
  import { targets } from '../stores/targets';
  import { snackbar } from '../stores/snackbar';
  import { dayjs } from '../types'; // ensure consistent dayjs instance
  import { onMount } from 'svelte';
  import { createCalendarStore, loadCalendarMonth } from '../services/calendar';

  
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
    
    return { date: selected, month: current };
  }

  const initialDates = getInitialDates();
  let selectedDate = $state(initialDates); // actual selected date

  let showImportModal = $state(false);

  // Create calendar store that reactively updates based on currentMonth and timers
  let calendarStore = $derived(
    createCalendarStore(selectedDate.date.year(), selectedDate.month.month() + 1, 1, $timers, $targets)
  );
  let calendarData = $derived($calendarStore);

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

<div class="flex flex-col h-screen">
  <!-- Header spanning full width -->
  <div class="w-full px-4 pt-6 pb-2">
    <div class="w-full max-w-7xl mx-auto flex justify-between items-center">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">History</h1>
      <button
        onclick={handleImportClick}
        class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors icon-[si--file-upload-duotone] text-gray-600 dark:text-gray-400"
        style="width: 28px; height: 28px;"
        aria-label="Import timelogs"
      ></button>
    </div>
  </div>

  <!-- Main content area: Calendar (slim) + Balances + Daily details/logs -->
  <div class="w-full flex-1 overflow-y-auto min-h-0">
    <div class="w-full p-4 grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
      <!-- Column 1: Calendar (max width 400px) -->
      <div class="w-full max-w-[400px] mx-auto">
        <HistoryCalendar
          timeLogs={Array.from(calendarData.timeLogsByDate.values()).flat()}
          calendarData={calendarData}
          selectedDate={selectedDate}
        />
      </div>

      <!-- Column 2: Yearly + Monthly balance -->
      <div class="w-full flex flex-col gap-4">
        <BalancesOverview
          title="Balance Overview"
          targets={$targets}
          periods={{
            day: { date: selectedDate.date.format('YYYY-MM-DD') },
            month: { year: selectedDate.month.year(), month: selectedDate.month.month() + 1 },
            year: { year: selectedDate.month.year() },
          }}
        />
      </div>

      <!-- Column 3: Daily balance + history logs -->
      <div class="w-full flex flex-col gap-4">

        <div class="flex flex-col">

          <HistoryLogs
            {selectedDate}
            timeLogs={calendarData.timeLogsByDate.get(selectedDate.date.format('YYYY-MM-DD')) || []}
            timers={$timers}
            relevantHolidays={calendarData.relevantHolidays.get(selectedDate.date.format('YYYY-MM-DD')) || []}
          />
        </div>
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

