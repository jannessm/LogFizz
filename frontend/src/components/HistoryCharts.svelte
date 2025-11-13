<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
  import dayjs from 'dayjs';

  export let buttons: any[];
  export let timeLogs: any[];
  export let currentMonth: dayjs.Dayjs;

  let pieChartCanvas: HTMLCanvasElement;
  let barChartCanvas: HTMLCanvasElement;
  let pieChart: Chart | null = null;
  let barChart: Chart | null = null;

  // Update charts when data or month changes
  $: if (timeLogs.length > 0 && buttons.length > 0 && pieChartCanvas && barChartCanvas) {
    setTimeout(() => updateCharts(), 100);
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
    if (buttons.length === 0) return;
    
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
    
    // Always create bar chart
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

  onMount(() => {
    Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
  });
</script>

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
