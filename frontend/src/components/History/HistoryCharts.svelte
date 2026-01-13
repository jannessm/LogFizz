<script lang="ts">
  import dayjs from 'dayjs';
  import PieChart from './PieChart.svelte';
  import BarChart from './BarChart.svelte';
            
  let { timers, timeLogs, currentMonth, dateSelect }: {
    timers: any[];
    timeLogs: any[];
    currentMonth: dayjs.Dayjs;
    dateSelect?: (date: any) => void;
  } = $props();
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
  <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Monthly Summary</h3>
  {#if timeLogs.length === 0}
    <p class="text-gray-500 dark:text-gray-400 text-sm">No time logs for this month.</p>
  {:else}
    <div class="h-40">
      <PieChart 
        {timers}
        {currentMonth}
        {timeLogs}
      />
    </div>
    <div class="h-48 mt-4">
      <BarChart
        {timers}
        {currentMonth}
        {timeLogs}
        {dateSelect}
      />
    </div>
  {/if}
</div>
