<script lang="ts">
  import BottomNav from '../components/BottomNav.svelte';

  import {
    HistoryCharts, HistoryCalendar,
    HistoryLogs, BalancesOverview, OverallBalanceOverview
  } from '../components/history';
  import { timers } from '../stores/timers';
  import { targets } from '../stores/targets';
  import { activeTimeLogs } from '../stores/timelogs';
  import { dayjs } from '../types'; // ensure consistent dayjs instance
  import { createCalendarStore, loadCalendarMonth } from '../services/calendar';
  import { navigate } from '../lib/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { _ } from '../lib/i18n';
  import { startBalanceUpdates, stopBalanceUpdates } from '../stores/live-balance';

  const HISTORY_COMPONENT_ID = 'history-page';

  
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

  // Create calendar store that reactively updates based on currentMonth and timers
  let calendarStore = $derived(
    createCalendarStore(selectedDate.month.year(), selectedDate.month.month() + 1, 1, $timers, $targets)
  );
  let calendarData = $derived($calendarStore);

  // Load calendar data on mount and when month changes
  onMount(async () => {
    await loadCalendarMonth(selectedDate.month.year(), selectedDate.month.month() + 1);
  });

  // Watch for month changes and load data
  $effect(() => {
    const year = selectedDate.month.year();
    const month = selectedDate.month.month() + 1;
    loadCalendarMonth(year, month);
  });

  // Start/stop live balance updates when today is selected and there are active timers
  $effect(() => {
    const todaySelected = selectedDate.date.isSame(dayjs(), 'day');
    const hasActive = $activeTimeLogs.length > 0;

    if (todaySelected && hasActive) {
      startBalanceUpdates(HISTORY_COMPONENT_ID);
    } else {
      stopBalanceUpdates(HISTORY_COMPONENT_ID);
    }
  });

  onDestroy(() => {
    stopBalanceUpdates(HISTORY_COMPONENT_ID);
  });

  function handleImportClick() {
    navigate('/import?from=history');
  }

  function handleExportClick() {
    // Navigate to export page with current date
    const params = new URLSearchParams();
    params.set('from', 'history');
    params.set('date', selectedDate.month.format('YYYY-MM-DD'));
    navigate(`/export?${params.toString()}`);
  }

  function navigateToTable() {
    // Preserve the starting date parameter when navigating to table
    const params = new URLSearchParams();
    params.set('date', selectedDate.month.format('YYYY-MM-DD'));
    
    const path = `/table?${params.toString()}`;
    navigate(path);
  }
</script>

<div class="flex flex-col h-screen">
  <!-- Header spanning full width -->
  <div class="w-full px-4 pt-6 pb-2">
    <div class="w-full max-w-7xl mx-auto flex justify-between items-center">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">{$_('history.title')}</h1>
      <div class="flex gap-1">
        <button
          onclick={navigateToTable}
          class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors icon-[si--table-duotone] text-gray-600 dark:text-gray-400"
          style="width: 28px; height: 28px;"
          aria-label={$_('table.tableView')}
        ></button>
        <button
          onclick={handleExportClick}
          class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors icon-[si--file-upload-duotone] text-gray-600 dark:text-gray-400"
          style="width: 28px; height: 28px;"
          aria-label={$_('export.title')}
        ></button>
        <button
          onclick={handleImportClick}
          class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors icon-[si--file-download-duotone] text-gray-600 dark:text-gray-400"
          style="width: 28px; height: 28px;"
          aria-label={$_('import.title')}
        ></button>
      </div>
    </div>
  </div>

  <!-- Main content area: Calendar (slim) + Balances + Daily details/logs -->
  <div class="w-full flex-1 overflow-y-auto min-h-0">
    <div class="w-full max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
      <!-- Column 1: Overall Balance (mobile) / Calendar (desktop) -->
      <div class="w-full max-w-[400px] mx-auto order-first lg:order-none flex flex-col gap-4">
        <div class="lg:hidden">
          <OverallBalanceOverview
            title={$_('history.overallBalance')}
            targets={$targets}
            periods={{
              year: { year: selectedDate.month.year() },
            }}
          />
        </div>
        <div class="hidden lg:block">
          <HistoryCalendar
            timeLogs={Array.from(calendarData.timeLogsByDate.values()).flat()}
            calendarData={calendarData}
            bind:selectedDate
          />
        </div>
      </div>

      <!-- Column 2: Yearly + Monthly balance (desktop only) -->
      <div class="w-full flex flex-col gap-4 hidden lg:flex">
        <OverallBalanceOverview
          title={$_('history.overallBalance')}
          targets={$targets}
          periods={{
            year: { year: selectedDate.month.year() },
          }}
        />
        <BalancesOverview
          title={$_('history.balance')}
          targets={$targets}
          periods={{
            day: { date: selectedDate.date.format('YYYY-MM-DD') },
            month: { year: selectedDate.month.year(), month: selectedDate.month.month() + 1 },
            year: { year: selectedDate.month.year() },
          }}
        />
      </div>

      <!-- Column 3: Daily balance + history logs (desktop) / Mobile content -->
      <div class="w-full flex flex-col gap-4 lg:order-none">
        <div class="lg:hidden">
          <HistoryCalendar
            timeLogs={Array.from(calendarData.timeLogsByDate.values()).flat()}
            calendarData={calendarData}
            bind:selectedDate
          />
        </div>
        <div class="lg:hidden">
          <BalancesOverview
            title={$_('history.balance')}
            targets={$targets}
            periods={{
              day: { date: selectedDate.date.format('YYYY-MM-DD') },
              month: { year: selectedDate.month.year(), month: selectedDate.month.month() + 1 },
              year: { year: selectedDate.month.year() },
            }}
          />
        </div>

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
</div>
