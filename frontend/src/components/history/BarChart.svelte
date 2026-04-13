<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
  import { numberToHoursMinutes } from '../../lib/chart_utils';
  import dayjs from 'dayjs';
  import { _ } from '../../lib/i18n';

  let { timers, currentMonth, timeLogs, dateSelect }: {
    timers: any[];
    currentMonth: any;
    timeLogs: any[];
    dateSelect?: ((date: any) => void);
  } = $props();
  
  let labels: string[] = $state([]);
  let title: string = $state('');

  let canvas: HTMLCanvasElement | null = $state(null);
  let chart: Chart | null = $state(null);
  let refreshTick = $state(0); // Used to trigger reactivity for running sessions
  let intervalId: number | undefined;
  let chartCreated = $state(false);

  // Update chart when data changes
  $effect(() => {
    if (canvas && (timeLogs.length > 0 || refreshTick) && timers.length > 0) {
      const daysInMonth = currentMonth.daysInMonth();
      labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      updateChart();
    }
  });

  // Calculate daily stats per timer for stacked bar chart
  function getDailyStatsPerTimer() {
    const daysInMonth = currentMonth.daysInMonth();
    const now = dayjs();

    // Create a map to store daily durations per timer
    const buttonDailyData = new Map<string, number[]>();
    
    // Initialize arrays for each button
    timers.forEach(timer => {
      buttonDailyData.set(timer.id, new Array(daysInMonth).fill(0));
    });
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = currentMonth.date(day);
      const dateStr = date.format('YYYY-MM-DD');
      
      // Filter logs for this day
      const dayLogs = timeLogs.filter(tl => 
        tl.start_timestamp && tl.start_timestamp.startsWith(dateStr)
      );
      
      // Sum durations for each button
      for (const log of dayLogs) {
        let duration = log.duration_minutes;
        
        // For running sessions (no end_timestamp), calculate duration to current time
        if (!log.end_timestamp && log.start_timestamp) {
          const start = dayjs(log.start_timestamp);
          duration = now.diff(start, 'minute');
        } else if (log.end_timestamp && (duration === undefined || duration === null)) {
          // Calculate if not stored
          duration = Math.floor(
            (new Date(log.end_timestamp).getTime() - new Date(log.start_timestamp).getTime()) / 60000
          );
        }
        
        if (duration !== undefined && duration !== null) {
          const buttonData = buttonDailyData.get(log.timer_id);
          if (buttonData) {
            buttonData[day - 1] += duration / 60; // Convert to hours
          }
        }
      }
    }
    
    return buttonDailyData;
  }
  
  function updateChart() {
    if (!canvas) return;

    // Get stacked data per timer
    const timerDailyData = getDailyStatsPerTimer();

    // Create datasets for each timer
    const datasets = timers.map(timer => {
      const timerData = timerDailyData.get(timer.id) || [];
      return {
        label: timer.name,
        data: timerData,
        backgroundColor: timer.color || '#3B82F6',
        borderColor: timer.color || '#3B82F6',
        borderWidth: 1
      };
    });

    // If chart exists, update data without animation
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets = datasets as any;
      (chart.options as any).animation = false;
      chart.update();
      chartCreated = true;
      return;
    }

    // Create new stacked chart (animate on first creation only)
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartCreated ? false : undefined,
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const dayNumber = index + 1;
            const selectedDate = currentMonth.date(dayNumber);
            
            // Call the callback if provided
            if (dateSelect) {
              dateSelect(selectedDate);
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 15
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                const numValue = typeof value === 'number' ? value : 0;
                return numberToHoursMinutes(numValue);
              }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 8,
              font: { size: 10 }
            }
          },
          tooltip: {
            enabled: false
          }
        }
      }
    });
    chartCreated = true;
  }

  // Check if there are any running sessions
  function hasRunningSessions(): boolean {
    return timeLogs.some(tl => tl.start_timestamp && !tl.end_timestamp);
  }

  onMount(() => {
    Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
    
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

<div class="h-full flex flex-col">
  {#if title}
    <h4 class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{title}</h4>
  {/if}
  <div class="flex-1">
    {#if timeLogs.length > 0}
      <canvas bind:this={canvas}></canvas>
    {:else}
      <p class="text-gray-400 dark:text-gray-500 text-sm text-center py-8">{$_('common.noDataAvailable')}</p>
    {/if}
  </div>
</div>
