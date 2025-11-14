<script lang="ts">
  import dayjs from 'dayjs';
  import PieChart from './PieChart.svelte';
  import BarChart from './BarChart.svelte';

  export let buttons: any[];
  export let timeLogs: any[];
  export let currentMonth: dayjs.Dayjs;
  export let onDateSelect: ((date: any) => void) | undefined = undefined;

</script>

<div class="bg-white rounded-lg shadow-md p-4 mb-6">
  <h3 class="text-sm font-semibold text-gray-700 mb-3">Monthly Summary</h3>
  {#if timeLogs.length === 0}
    <p class="text-gray-500 text-sm">No time logs for this month.</p>
  {:else}
    <div class="h-40">
      <PieChart 
        {buttons}
        {currentMonth}
        {timeLogs}
      />
    </div>
    <div class="h-48 mt-4">
      <BarChart
        {buttons}
        {currentMonth}
        {timeLogs}
        {onDateSelect}
      />
    </div>
  {/if}
</div>
