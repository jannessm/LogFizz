<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, PieController, ArcElement, Tooltip, Legend } from 'chart.js';
  import dayjs from 'dayjs';
  import { numberToHoursMinutes } from '../../lib/chart_utils';
  
  export let buttons: any[];
  export let title: string = '';
  export let currentMonth: dayjs.Dayjs;
  export let timeLogs: any[];

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let labels: string[] = [];
  let data: number[] = [];
  let colors: string[] = [];

  // Update chart when data changes
  $: if (canvas && timeLogs.length > 0) {
    labels = [];
    data = [];
    colors = [];

    // Prepare data for pie chart
    const monthlyStats = getMonthlyButtonStats();
    
    monthlyStats.forEach((minutes, buttonId) => {
      const button = buttons.find(b => b.id === buttonId);
      if (button) {
        labels.push(button.name);
        data.push(minutes / 60); // Convert to hours
        colors.push(button.color || '#3B82F6');
      }
    });

    updateChart();
  }

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

  function updateChart() {
    if (!canvas) return;
    
    // Destroy existing chart
    if (chart) {
      chart.destroy();
      chart = null;
    }
    
    // Create new chart if we have data
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
    }
  }

  onMount(() => {
    Chart.register(PieController, ArcElement, Tooltip, Legend);
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
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
