<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
  import { numberToHoursMinutes } from '../../lib/chart_utils';
  import { createEventDispatcher } from 'svelte';
  
  export let buttons: any[];
  export let currentMonth: any;
  export let timeLogs: any[];
  export let onDateSelect: ((date: any) => void) | undefined = undefined;
  
  const dispatch = createEventDispatcher();

  let labels: string[];
  let title: string = '';

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  // Update chart when data changes
  $: if (canvas && timeLogs.length > 0 && buttons.length > 0) {
    const daysInMonth = currentMonth.daysInMonth();
    labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    updateChart();
  }

  // Calculate daily stats per button for stacked bar chart
  function getDailyStatsPerButton() {
    const daysInMonth = currentMonth.daysInMonth();
    
    // Create a map to store daily durations per button
    const buttonDailyData = new Map<string, number[]>();
    
    // Initialize arrays for each button
    buttons.forEach(button => {
      buttonDailyData.set(button.id, new Array(daysInMonth).fill(0));
    });
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = currentMonth.date(day);
      const dateStr = date.format('YYYY-MM-DD');
      
      const dayLogs = timeLogs.filter(tl => 
        tl.timestamp && tl.timestamp.startsWith(dateStr)
      ).sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      const startsByButton = new Map<string, typeof dayLogs[0]>();
      
      for (const log of dayLogs) {
        if (log.type === 'start') {
          startsByButton.set(log.button_id, log);
        } else if (log.type === 'stop') {
          const start = startsByButton.get(log.button_id);
          if (start) {
            const duration = Math.floor(
              (new Date(log.timestamp).getTime() - new Date(start.timestamp).getTime()) / 60000
            );
            const buttonData = buttonDailyData.get(log.button_id);
            if (buttonData) {
              buttonData[day - 1] += duration / 60; // Convert to hours
            }
            startsByButton.delete(log.button_id);
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

  onMount(() => {
    Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
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
