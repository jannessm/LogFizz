<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import { timeLogsStore } from '../stores/timelogs';
  import { buttonsStore } from '../stores/buttons';
  import dayjs from 'dayjs';

  let selectedDate = dayjs();
  let currentMonth = dayjs();

  $: timeLogs = $timeLogsStore.timeLogs;
  $: buttons = $buttonsStore.buttons;

  onMount(async () => {
    await timeLogsStore.load();
    await buttonsStore.load();
  });

  // Get calendar days for current month
  function getCalendarDays() {
    const firstDay = currentMonth.startOf('month');
    const lastDay = currentMonth.endOf('month');
    const startDate = firstDay.startOf('week');
    const endDate = lastDay.endOf('week');
    
    const days = [];
    let current = startDate;
    
    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }
    
    return days;
  }

  $: calendarDays = getCalendarDays();

  // Get button activities for a specific date
  function getButtonsForDate(date: dayjs.Dayjs) {
    const dateStr = date.format('YYYY-MM-DD');
    const buttonIds = new Set(
      timeLogs
        .filter(tl => tl.start_time.startsWith(dateStr))
        .map(tl => tl.button_id)
    );
    return buttons.filter(b => buttonIds.has(b.id));
  }

  // Get time logs for selected date
  function getLogsForSelectedDate() {
    const dateStr = selectedDate.format('YYYY-MM-DD');
    return timeLogs
      .filter(tl => tl.start_time.startsWith(dateStr))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }

  $: selectedDateLogs = getLogsForSelectedDate();

  function previousMonth() {
    currentMonth = currentMonth.subtract(1, 'month');
  }

  function nextMonth() {
    currentMonth = currentMonth.add(1, 'month');
  }

  function selectDate(date: dayjs.Dayjs) {
    selectedDate = date;
  }

  function formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  function isToday(date: dayjs.Dayjs): boolean {
    return date.isSame(dayjs(), 'day');
  }

  function isSelected(date: dayjs.Dayjs): boolean {
    return date.isSame(selectedDate, 'day');
  }

  function isCurrentMonth(date: dayjs.Dayjs): boolean {
    return date.isSame(currentMonth, 'month');
  }
</script>

<div class="min-h-screen bg-gray-50 pb-16">
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800">History</h1>
      <div class="flex items-center gap-2">
        <button
          on:click={previousMonth}
          class="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span class="font-semibold text-lg min-w-[150px] text-center">
          {currentMonth.format('MMMM YYYY')}
        </span>
        <button
          on:click={nextMonth}
          class="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          aria-label="Next month"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Calendar -->
    <div class="bg-white rounded-lg shadow-md p-4 mb-6">
      <!-- Calendar header (day names) -->
      <div class="grid grid-cols-7 gap-1 mb-2">
        {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
          <div class="text-center text-xs font-semibold text-gray-600 py-2">
            {day}
          </div>
        {/each}
      </div>

      <!-- Calendar days -->
      <div class="grid grid-cols-7 gap-1">
        {#each calendarDays as day}
          {@const dayButtons = getButtonsForDate(day)}
          <button
            on:click={() => selectDate(day)}
            class="aspect-square p-1 rounded-lg transition-all hover:bg-gray-100 relative"
            class:bg-blue-100={isSelected(day)}
            class:ring-2={isSelected(day)}
            class:ring-blue-500={isSelected(day)}
            class:bg-blue-50={isToday(day) && !isSelected(day)}
            class:text-gray-400={!isCurrentMonth(day)}
            class:font-bold={isToday(day)}
          >
            <div class="text-sm mb-1">
              {day.format('D')}
            </div>
            {#if dayButtons.length > 0}
              <div class="flex flex-wrap gap-0.5 justify-center">
                {#each dayButtons.slice(0, 3) as button}
                  <div
                    class="w-1.5 h-1.5 rounded-full"
                    style="background-color: {button.color || '#3B82F6'}"
                    title={button.name}
                  ></div>
                {/each}
              </div>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <!-- Selected Date Activities -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">
        Activities on {selectedDate.format('MMMM D, YYYY')}
        {#if isToday(selectedDate)}
          <span class="text-sm font-normal text-blue-600">(Today)</span>
        {/if}
      </h2>
      
      {#if selectedDateLogs.length > 0}
        <div class="space-y-3">
          {#each selectedDateLogs as log}
            {@const button = buttons.find(b => b.id === log.button_id)}
            {#if button}
              <div class="flex items-center gap-3 border-b border-gray-100 pb-3 last:border-b-0">
                <div
                  class="w-3 h-3 rounded-full flex-shrink-0"
                  style="background-color: {button.color || '#3B82F6'}"
                ></div>
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    {#if button.emoji}
                      <span class="text-lg">{button.emoji}</span>
                    {/if}
                    <p class="font-medium text-gray-800">{button.name}</p>
                  </div>
                  <p class="text-sm text-gray-500">
                    {dayjs(log.start_time).format('HH:mm')}
                    {#if log.end_time}
                      - {dayjs(log.end_time).format('HH:mm')}
                    {:else}
                      - Running...
                    {/if}
                  </p>
                </div>
                {#if log.end_time}
                  {@const duration = Math.floor((new Date(log.end_time).getTime() - new Date(log.start_time).getTime()) / 60000)}
                  <p class="text-sm font-semibold text-gray-700">{formatMinutes(duration)}</p>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      {:else}
        <p class="text-gray-500 text-center py-8">No activities on this date</p>
      {/if}
    </div>
  </div>

  <BottomNav currentTab="history" />
</div>
