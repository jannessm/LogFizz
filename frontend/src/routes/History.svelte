<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import TimelogForm from '../components/TimelogForm.svelte';
  import { timeLogsStore } from '../stores/timelogs';
  import { buttonsStore } from '../stores/buttons';
  import dayjs from 'dayjs';
  import weekOfYear from 'dayjs/plugin/weekOfYear';
  import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

  // Register dayjs plugins
  dayjs.extend(weekOfYear);

  // Register Chart.js components
  Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

  let selectedDate = dayjs();
  let currentMonth = dayjs();
  let showTimelogForm = false;
  let editingTimelog: any = null;
  let showDeleteConfirm = false;
  let deleteTarget: any = null;
  let pieChartCanvas: HTMLCanvasElement;
  let barChartCanvas: HTMLCanvasElement;
  let pieChart: Chart | null = null;
  let barChart: Chart | null = null;
  let slideDirection: 'left' | 'right' | null = null;
  let isAnimating = false;

  $: timeLogs = $timeLogsStore.timeLogs;
  $: buttons = $buttonsStore.buttons;

  onMount(async () => {
    // Load data in parallel for faster initial render
    Promise.all([
      timeLogsStore.load(),
      buttonsStore.load()
    ]).then(() => {
      // Update charts after data is loaded
      setTimeout(() => updateCharts(), 100);
    });
  });

  // Update charts when data changes
  $: if (timeLogs.length > 0 && buttons.length > 0) {
    setTimeout(() => updateCharts(), 100);
  }

  // Get calendar days for current month - ensure we have exactly 6 weeks (42 days)
  function getCalendarDays() {
    const firstDay = currentMonth.startOf('month');
    const lastDay = currentMonth.endOf('month');
    
    // Get the day of week for the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDay.day();
    
    // Calculate how many days to show before the first of the month
    const startDate = firstDay.subtract(firstDayOfWeek, 'day');
    
    // Always show 6 weeks (42 days) for consistent layout
    const days = [];
    let current = startDate;
    
    for (let i = 0; i < 42; i++) {
      days.push(current);
      current = current.add(1, 'day');
    }
    
    return days;
  }

  // Get week numbers for the calendar (6 weeks)
  function getWeekNumbers() {
    const weeks = [];
    const days = getCalendarDays();
    
    // Get week number for the first day of each week (every 7 days)
    for (let i = 0; i < 42; i += 7) {
      weeks.push(days[i].week());
    }
    
    return weeks;
  }

  $: calendarDays = getCalendarDays();
  $: weekNumbers = getWeekNumbers();

  // Get button activities for a specific date
  function getButtonsForDate(date: dayjs.Dayjs) {
    const dateStr = date.format('YYYY-MM-DD');
    const buttonIds = new Set(
      timeLogs
        .filter(tl => tl.timestamp && tl.timestamp.startsWith(dateStr))
        .map(tl => tl.button_id)
    );
    return buttons.filter(b => buttonIds.has(b.id));
  }

  // Get time logs for selected date and pair them into sessions
  function getSessionsForSelectedDate() {
    const dateStr = selectedDate.format('YYYY-MM-DD');
    const logs = timeLogs
      .filter(tl => tl.timestamp && tl.timestamp.startsWith(dateStr))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Pair start/stop events into sessions
    const sessions: Array<{
      button_id: string;
      startTime: string;
      endTime?: string;
      startLog: typeof logs[0];
      stopLog?: typeof logs[0];
    }> = [];
    
    const startsByButton = new Map<string, typeof logs[0]>();
    
    for (const log of logs) {
      if (log.type === 'start') {
        // New start event - save it
        startsByButton.set(log.button_id, log);
      } else if (log.type === 'stop') {
        // Stop event - pair with most recent start for this button
        const start = startsByButton.get(log.button_id);
        if (start) {
          sessions.push({
            button_id: log.button_id,
            startTime: start.timestamp,
            endTime: log.timestamp,
            startLog: start,
            stopLog: log,
          });
          startsByButton.delete(log.button_id);
        }
      }
    }
    
    // Add any remaining unpaired starts as active sessions
    for (const [button_id, start] of startsByButton.entries()) {
      sessions.push({
        button_id,
        startTime: start.timestamp,
        startLog: start,
      });
    }
    
    return sessions.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  $: selectedDateSessions = getSessionsForSelectedDate();

  // Calculate total time per button for the current month
  function getMonthlyButtonStats() {
    const monthStart = currentMonth.startOf('month').format('YYYY-MM-DD');
    const monthEnd = currentMonth.endOf('month').format('YYYY-MM-DD');
    
    const stats = new Map<string, number>();
    
    // Get all logs for the month
    const monthLogs = timeLogs.filter(tl => {
      if (!tl.timestamp) return false;
      const logDate = tl.timestamp.substring(0, 10);
      return logDate >= monthStart && logDate <= monthEnd;
    });
    
    // Pair start/stop to calculate durations
    const startsByButton = new Map<string, typeof monthLogs[0]>();
    
    for (const log of monthLogs.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )) {
      if (log.type === 'start') {
        startsByButton.set(log.button_id, log);
      } else if (log.type === 'stop') {
        const start = startsByButton.get(log.button_id);
        if (start) {
          const duration = Math.floor(
            (new Date(log.timestamp).getTime() - new Date(start.timestamp).getTime()) / 60000
          );
          stats.set(log.button_id, (stats.get(log.button_id) || 0) + duration);
          startsByButton.delete(log.button_id);
        }
      }
    }
    
    return stats;
  }

  // Calculate daily totals for bar chart
  function getDailyStats() {
    const daysInMonth = currentMonth.daysInMonth();
    const dailyTotals: number[] = new Array(daysInMonth).fill(0);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = currentMonth.date(day);
      const dateStr = date.format('YYYY-MM-DD');
      
      const dayLogs = timeLogs.filter(tl => 
        tl.timestamp && tl.timestamp.startsWith(dateStr)
      ).sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      const startsByButton = new Map<string, typeof dayLogs[0]>();
      let totalMinutes = 0;
      
      for (const log of dayLogs) {
        if (log.type === 'start') {
          startsByButton.set(log.button_id, log);
        } else if (log.type === 'stop') {
          const start = startsByButton.get(log.button_id);
          if (start) {
            const duration = Math.floor(
              (new Date(log.timestamp).getTime() - new Date(start.timestamp).getTime()) / 60000
            );
            totalMinutes += duration;
            startsByButton.delete(log.button_id);
          }
        }
      }
      
      dailyTotals[day - 1] = totalMinutes / 60; // Convert to hours
    }
    
    return dailyTotals;
  }

  function updateCharts() {
    if (!pieChartCanvas || !barChartCanvas) return;
    if (buttons.length === 0) return; // Wait for buttons to load
    
    const monthlyStats = getMonthlyButtonStats();
    const dailyStats = getDailyStats();
    
    // Pie Chart Data
    const pieLabels: string[] = [];
    const pieData: number[] = [];
    const pieColors: string[] = [];
    
    monthlyStats.forEach((minutes, buttonId) => {
      const button = buttons.find(b => b.id === buttonId);
      if (button) {
        pieLabels.push(button.name);
        pieData.push(minutes / 60); // Convert to hours
        pieColors.push(button.color || '#3B82F6');
      }
    });
    
    // Destroy and recreate pie chart if it exists
    if (pieChart) {
      pieChart.destroy();
      pieChart = null;
    }
    
    // Create pie chart if we have data
    if (pieLabels.length > 0) {
      pieChart = new Chart(pieChartCanvas, {
        type: 'pie',
        data: {
          labels: pieLabels,
          datasets: [{
            data: pieData,
            backgroundColor: pieColors,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                padding: 8,
                font: { size: 10 }
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const hours = Math.floor(context.parsed as number);
                  const mins = Math.round(((context.parsed as number) - hours) * 60);
                  return `${context.label}: ${hours}h ${mins}m`;
                }
              }
            }
          }
        }
      });
    }
    
    // Bar Chart Data
    const barLabels = Array.from({ length: dailyStats.length }, (_, i) => String(i + 1));
    
    // Destroy and recreate bar chart if it exists
    if (barChart) {
      barChart.destroy();
      barChart = null;
    }
    
    // Always create bar chart (even with no data, to show empty state)
    barChart = new Chart(barChartCanvas, {
      type: 'bar',
      data: {
        labels: barLabels,
        datasets: [{
          label: 'Hours',
          data: dailyStats,
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => value + 'h'
            }
          },
          x: {
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 15
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const hours = Math.floor(context.parsed.y);
                const mins = Math.round((context.parsed.y - hours) * 60);
                return `${hours}h ${mins}m`;
              }
            }
          }
        }
      }
    });
  }

  async function previousMonth() {
    if (isAnimating) return;
    isAnimating = true;
    slideDirection = 'right';
    setTimeout(() => {
      currentMonth = currentMonth.subtract(1, 'month');
      slideDirection = null;
      isAnimating = false;
    }, 300);
  }

  async function nextMonth() {
    if (isAnimating) return;
    isAnimating = true;
    slideDirection = 'left';
    setTimeout(() => {
      currentMonth = currentMonth.add(1, 'month');
      slideDirection = null;
      isAnimating = false;
    }, 300);
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

  // Get button colors for date (for dots display)
  function getButtonColorsForDate(date: dayjs.Dayjs): string[] {
    const dateButtons = getButtonsForDate(date);
    return dateButtons.slice(0, 3).map(b => b.color || '#3B82F6');
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
    const { button_id, startTimestamp, endTimestamp, existingLog } = event.detail;
    
    // For now, just add new entries
    // In a full implementation, you'd call the API to create/update timelogs
    await timeLogsStore.create(button_id, startTimestamp, 'start');
    if (endTimestamp) {
      await timeLogsStore.create(button_id, endTimestamp, 'stop');
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
    
    // Delete the timelog entries
    if (deleteTarget.startLog?.id) {
      await timeLogsStore.delete(deleteTarget.startLog.id);
    }
    if (deleteTarget.stopLog?.id) {
      await timeLogsStore.delete(deleteTarget.stopLog.id);
    }
    
    showDeleteConfirm = false;
    deleteTarget = null;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
    deleteTarget = null;
  }
</script>

<div class="min-h-screen bg-gray-50 pb-16">
  <div class="max-w-[500px] mx-auto px-4 py-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800">History</h1>
      <div class="flex items-center gap-2">
        <button
          on:click={previousMonth}
          class="p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Previous month"
          disabled={isAnimating}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span class="font-semibold text-lg min-w-[150px] text-center text-gray-800">
          {currentMonth.format('MMMM YYYY')}
        </span>
        <button
          on:click={nextMonth}
          class="p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Next month"
          disabled={isAnimating}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Charts -->
    <div class="bg-white rounded-lg shadow-md p-4 mb-6">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Monthly Summary</h3>
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="h-40 flex items-center justify-center">
          <canvas bind:this={pieChartCanvas}></canvas>
        </div>
        <div class="text-xs text-gray-600 flex items-center">
          <p>Time distribution across buttons for {currentMonth.format('MMMM')}</p>
        </div>
      </div>
      <div class="h-48 mt-4">
        <canvas bind:this={barChartCanvas}></canvas>
      </div>
    </div>

    <!-- Calendar -->
    <div class="bg-white rounded-lg shadow-md p-4 mb-6 overflow-hidden">
      <div class="transition-transform duration-300"
           class:translate-x-full={slideDirection === 'left'}
           class:-translate-x-full={slideDirection === 'right'}>
        <!-- Calendar header (day names) -->
        <div class="grid gap-1 mb-2" style="grid-template-columns: 32px repeat(7, 1fr);">
          <div class="text-center text-xs font-semibold text-gray-500 py-2">
            Wk
          </div>
          {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
            <div class="text-center text-xs font-semibold text-gray-600 py-2">
              {day}
            </div>
          {/each}
        </div>

        <!-- Calendar days with week numbers -->
        <div class="grid gap-1" style="grid-template-columns: 32px repeat(7, 1fr);">
          {#each Array(6) as _, weekIndex}
            <!-- Week number -->
            <div class="flex items-center justify-center text-xs font-medium text-gray-500">
              {weekNumbers[weekIndex]}
            </div>
            
            <!-- Days of the week -->
            {#each calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7) as day}
            {@const buttonColors = getButtonColorsForDate(day)}
            {@const today = isToday(day)}
            {@const selected = isSelected(day)}
            {@const currentMonthDay = isCurrentMonth(day)}
            <button
              on:click={() => selectDate(day)}
              class="relative w-full aspect-square flex flex-col items-center justify-center transition-all hover:scale-105 py-1"
              class:text-gray-400={!currentMonthDay}
              class:text-gray-800={currentMonthDay && !selected}
              class:text-white={selected}
              class:font-bold={today || selected}
            >
              <!-- Today indicator (light blue circle behind) -->
              {#if today && !selected}
                <div class="absolute inset-1 rounded-full bg-blue-100 border-2 border-blue-300"></div>
              {/if}
              
              <!-- Selected indicator (solid blue circle) -->
              {#if selected}
                <div class="absolute inset-0 rounded-full bg-blue-600 shadow-lg"></div>
              {/if}
              
              <!-- Date number -->
              <span class="relative text-sm z-10 mb-1">
                {day.format('D')}
              </span>
              
              <!-- Activity dots -->
              {#if buttonColors.length > 0}
                <div class="relative flex gap-0.5 z-10">
                  {#each buttonColors as color}
                    <div 
                      class="w-1 h-1 rounded-full"
                      style="background-color: {color};"
                    ></div>
                  {/each}
                </div>
              {/if}
            </button>
            {/each}
          {/each}
        </div>
      </div>
    </div>

    <!-- Selected Date Activities -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-800">
          {selectedDate.format('MMMM D, YYYY')}
          {#if isToday(selectedDate)}
            <span class="text-sm font-normal text-blue-600">(Today)</span>
          {/if}
        </h2>
        <button
          on:click={handleAddTimelog}
          class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>
      
      {#if selectedDateSessions.length > 0}
        <div class="space-y-3">
          {#each selectedDateSessions as session}
            {@const button = buttons.find(b => b.id === session.button_id)}
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
                    {dayjs(session.startTime).format('HH:mm')}
                    {#if session.endTime}
                      - {dayjs(session.endTime).format('HH:mm')}
                    {:else}
                      - Running...
                    {/if}
                  </p>
                </div>
                {#if session.endTime}
                  {@const duration = Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)}
                  <p class="text-sm font-semibold text-gray-700">{formatMinutes(duration)}</p>
                {/if}
                <div class="flex gap-1">
                  <button
                    on:click={() => handleEditTimelog(session)}
                    class="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    aria-label="Edit entry"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    on:click={() => confirmDelete(session)}
                    class="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    aria-label="Delete entry"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
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

  <!-- Timelog Form Modal -->
  {#if showTimelogForm}
    <TimelogForm
      {selectedDate}
      existingLog={editingTimelog}
      on:save={handleSaveTimelog}
      on:close={handleCloseForm}
    />
  {/if}

  <!-- Delete Confirmation Modal -->
  {#if showDeleteConfirm}
    <div 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="button"
      tabindex="-1"
      aria-label="Close dialog"
      on:click={cancelDelete}
      on:keydown={(e) => e.key === 'Escape' && cancelDelete()}
    >
      <div 
        class="bg-white rounded-lg shadow-xl w-full max-w-[400px] mx-4 p-6"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        on:click|stopPropagation
        on:keydown={() => {}}
      >
        <h3 class="text-lg font-bold text-gray-800 mb-2">Delete Time Entry?</h3>
        <p class="text-gray-600 mb-6">This action cannot be undone.</p>
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
  {/if}
</div>

<style>
  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
</style>
