<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import TimelogForm from '../components/TimelogForm.svelte';
  import { timeLogsStore } from '../stores/timelogs';
  import { buttonsStore } from '../stores/buttons';
  import dayjs from 'dayjs';
  import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

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
    await timeLogsStore.load();
    await buttonsStore.load();
  });

  afterUpdate(() => {
    updateCharts();
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
    
    // Update or create pie chart
    if (pieChart) {
      pieChart.data.labels = pieLabels;
      pieChart.data.datasets[0].data = pieData;
      pieChart.data.datasets[0].backgroundColor = pieColors;
      pieChart.update();
    } else if (pieLabels.length > 0) {
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
    
    // Update or create bar chart
    if (barChart) {
      barChart.data.labels = barLabels;
      barChart.data.datasets[0].data = dailyStats;
      barChart.update();
    } else {
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

  // Get gradient for date circle based on buttons used
  function getDateGradient(date: dayjs.Dayjs): string {
    const dateButtons = getButtonsForDate(date);
    if (dateButtons.length === 0) return '';
    if (dateButtons.length === 1) return `border-color: ${dateButtons[0].color || '#3B82F6'}`;
    
    const colors = dateButtons.slice(0, 4).map(b => b.color || '#3B82F6');
    const stops = colors.map((c, i) => `${c} ${(i / colors.length) * 100}%, ${c} ${((i + 1) / colors.length) * 100}%`).join(', ');
    return `border-image: linear-gradient(to right, ${stops}) 1`;
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
        <div class="h-32">
          <canvas bind:this={pieChartCanvas}></canvas>
        </div>
        <div class="text-xs text-gray-600 flex items-center">
          <p>Time distribution across buttons for {currentMonth.format('MMMM')}</p>
        </div>
      </div>
      <div class="h-40">
        <canvas bind:this={barChartCanvas}></canvas>
      </div>
    </div>

    <!-- Calendar -->
    <div class="bg-white rounded-lg shadow-md p-4 mb-6 overflow-hidden">
      <div class="transition-transform duration-300"
           class:translate-x-full={slideDirection === 'left'}
           class:-translate-x-full={slideDirection === 'right'}>
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
            {@const gradient = getDateGradient(day)}
            <button
              on:click={() => selectDate(day)}
              class="aspect-square p-1 rounded-full transition-all hover:bg-gray-100 relative flex items-center justify-center"
              class:bg-blue-100={isSelected(day)}
              class:bg-blue-50={isToday(day) && !isSelected(day)}
              class:text-gray-400={!isCurrentMonth(day)}
              class:text-gray-800={isCurrentMonth(day)}
              class:font-bold={isToday(day) || isSelected(day)}
              style="{isSelected(day) ? 'border: 3px solid #3B82F6;' : isToday(day) ? 'border: 2px solid #93C5FD;' : dayButtons.length > 0 ? `border: 2px solid; ${gradient}` : 'border: 1px solid transparent;'}"
            >
              <span class="text-sm">
                {day.format('D')}
              </span>
            </button>
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
