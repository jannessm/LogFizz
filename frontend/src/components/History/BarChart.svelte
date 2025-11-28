<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
  import { numberToHoursMinutes } from '../../lib/chart_utils';
  import { createEventDispatcher } from 'svelte';
  import dayjs from 'dayjs';
  
  export let buttons: any[];
  export let currentMonth: any;
  export let timeLogs: any[];
  export let onDateSelect: ((date: any) => void) | undefined = undefined;
  
  const dispatch = createEventDispatcher();

  let labels: string[];
  let title: string = '';

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let refreshTick = 0; // Used to trigger reactivity for running sessions
  let intervalId: number | undefined;

  // Update chart when data changes
  $: if (canvas && (timeLogs.length > 0 || refreshTick) && buttons.length > 0) {
    const daysInMonth = currentMonth.daysInMonth();
    labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    updateChart();
  }

  // Calculate daily stats per button for stacked bar chart
  function getDailyStatsPerButton() {
    const daysInMonth = currentMonth.daysInMonth();
    const now = dayjs();
    
    // Create a map to store daily durations per button
    const buttonDailyData = new Map<string, number[]>();
    
    // Initialize arrays for each button
    buttons.forEach(button => {
      buttonDailyData.set(button.id, new Array(daysInMonth).fill(0));
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
          const buttonData = buttonDailyData.get(log.button_id);
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
    
    // Destroy existing chart
    if (chart) {
      chart.destroy();
      chart = null;
    }
    
    // Get stacked data per button
    const buttonDailyData = getDailyStatsPerButton();
    
    // Create datasets for each button
    const datasets = buttons.map(button => {
      const buttonData = buttonDailyData.get(button.id) || [];
      return {
        label: button.name,
        data: buttonData,
        backgroundColor: button.color || '#3B82F6',
        borderColor: button.color || '#3B82F6',
        borderWidth: 1
      };
    });
    
    // Create new stacked chart
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const dayNumber = index + 1;
            const selectedDate = currentMonth.date(dayNumber);
            
            // Call the callback if provided
            if (onDateSelect) {
              onDateSelect(selectedDate);
            }
            
            // Dispatch event for parent components
            dispatch('dateSelect', { date: selectedDate });
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
    <h4 class="text-xs font-medium text-gray-600 mb-2">{title}</h4>
  {/if}
  <div class="flex-1">
    {#if timeLogs.length > 0}
      <canvas bind:this={canvas}></canvas>
    {:else}
      <p class="text-gray-400 text-sm text-center py-8">No data available</p>
    {/if}
  </div>
</div>
