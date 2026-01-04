<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, PieController, ArcElement, Tooltip, Legend } from 'chart.js';
  import dayjs from 'dayjs';
  import { numberToHoursMinutes } from '../../lib/chart_utils';
  import type { Timer } from '../../types';
 
  let { timers, title = '', currentMonth, timeLogs }: {
    timers: Timer[];
    title?: string;
    currentMonth: dayjs.Dayjs;
    timeLogs: any[];
  } = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let labels: string[] = [];
  let data: number[] = [];
  let colors: string[] = [];
  let refreshTick = 0; // Used to trigger reactivity for running sessions
  let intervalId: number | undefined;
  let chartCreated = false;

  // Update chart when data changes
  $effect(() => {
    if (canvas && timers && (timeLogs.length > 0 || refreshTick)) {
      labels = [];
      data = [];
      colors = [];

      // Prepare data for pie chart
      const monthlyStats = getMonthlyButtonStats();
      
      monthlyStats.forEach((minutes, buttonId) => {
        const button = timers.find(b => b.id === buttonId);
        if (button) {
          labels.push(button.name);
          data.push(minutes / 60); // Convert to hours
          colors.push(button.color || '#3B82F6');
        }
      });

      updateChart();
    }
  });

  // Calculate total time per button for the current month
  function getMonthlyButtonStats() {
    const monthStart = currentMonth.startOf('month').format('YYYY-MM-DD');
    const monthEnd = currentMonth.endOf('month').format('YYYY-MM-DD');
    const now = dayjs();
    
    const stats = new Map<string, number>();
    
    // Get all logs for the month - each log is already a session with duration
    const monthLogs = timeLogs.filter(tl => {
      if (!tl.start_timestamp) return false;
      const logDate = tl.start_timestamp.substring(0, 10);
      return logDate >= monthStart && logDate <= monthEnd;
    });
    
    // Sum up durations for each button
    for (const log of monthLogs) {
      let duration = log.duration_minutes;
      
      // For running sessions (no end_timestamp), calculate duration to current time
      if (!log.end_timestamp && log.start_timestamp) {
        const start = dayjs(log.start_timestamp);
        duration = now.diff(start, 'minute');
      } else if (log.end_timestamp && (duration === undefined || duration === null)) {
        // Calculate duration if not stored
        duration = Math.floor(
          (new Date(log.end_timestamp).getTime() - new Date(log.start_timestamp).getTime()) / 60000
        );
      }
      
      if (duration !== undefined && duration !== null) {
        stats.set(log.timer_id, (stats.get(log.timer_id) || 0) + duration);
      }
    }
    
    return stats;
  }

  function updateChart() {
    if (!canvas) return;

    // If chart exists, update its data without animation
    if (chart && labels.length > 0) {
  chart.data.labels = labels.map(l => l + ': ' + numberToHoursMinutes(data[labels.indexOf(l)]));
  (chart.data.datasets as any)[0].data = data;
  (chart.data.datasets as any)[0].backgroundColor = colors;
  (chart.options as any).animation = false;
  chart.update();
      chartCreated = true;
      return;
    }

    // Create new chart (animate on first creation only)
    if (labels.length > 0) {
      chart = new Chart(canvas, {
        type: 'pie',
        data: {
          labels: labels.map(l => l + ': ' + numberToHoursMinutes(data[labels.indexOf(l)])),
          datasets: [{
            data: data,
            backgroundColor: colors,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: chartCreated ? false : undefined,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12,
                padding: 8,
                font: { size: 10 },
              }
            },
            tooltip: { enabled: false },
          }
        }
      });
      chartCreated = true;
    }
  }

  // Check if there are any running sessions
  function hasRunningSessions(): boolean {
    return timeLogs.some(tl => tl.start_timestamp && !tl.end_timestamp);
  }

  onMount(() => {
    Chart.register(PieController, ArcElement, Tooltip, Legend);
    
    // Set up interval to refresh running sessions every 30 seconds
    if (hasRunningSessions()) {
      intervalId = window.setInterval(() => {
        if (hasRunningSessions()) {
          refreshTick++;
        } else if (intervalId) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      }, 30000); // Update every 30 seconds
    }
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
    if (intervalId) {
      window.clearInterval(intervalId);
    }
  });
</script>

<div class="h-40 flex flex-col">
  {#if title}
    <h4 class="text-xs font-medium text-gray-600 mb-2">{title}</h4>
  {/if}
  <div class="h-40 w-full flex-1 flex items-center justify-center">
    {#if timeLogs.length > 0}
      <canvas bind:this={canvas}></canvas>
    {:else}
      <p class="text-gray-400 text-sm">No data available</p>
    {/if}
  </div>
</div>
