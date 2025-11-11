<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import { timeLogsStore } from '../stores/timelogs';
  import { buttonsStore } from '../stores/buttons';
  import dayjs from 'dayjs';

  let selectedYear = new Date().getFullYear();
  let yearlyStats: any[] = [];

  $: timeLogs = $timeLogsStore.timeLogs;
  $: buttons = $buttonsStore.buttons;

  onMount(async () => {
    await timeLogsStore.load();
    await buttonsStore.load();
    calculateStats();
  });

  function calculateStats() {
    const stats = new Map<string, { name: string; totalMinutes: number; count: number }>();
    
    timeLogs.forEach(tl => {
      if (!tl.end_time) return;
      const year = new Date(tl.start_time).getFullYear();
      if (year !== selectedYear) return;

      const button = buttons.find(b => b.id === tl.button_id);
      if (!button) return;

      const start = new Date(tl.start_time).getTime();
      const end = new Date(tl.end_time).getTime();
      const minutes = Math.floor((end - start) / 60000);

      const existing = stats.get(button.id) || { name: button.name, totalMinutes: 0, count: 0 };
      existing.totalMinutes += minutes;
      existing.count += 1;
      stats.set(button.id, existing);
    });

    yearlyStats = Array.from(stats.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }

  $: {
    selectedYear;
    calculateStats();
  }

  function formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
</script>

<div class="min-h-screen bg-gray-50 pb-16">
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800">History</h1>
      <select
        bind:value={selectedYear}
        class="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {#each [2024, 2025, 2026] as year}
          <option value={year}>{year}</option>
        {/each}
      </select>
    </div>

    <!-- Statistics -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Yearly Statistics for {selectedYear}</h2>
      
      {#if yearlyStats.length > 0}
        <div class="space-y-4">
          {#each yearlyStats as stat}
            <div class="border-b border-gray-200 pb-3 last:border-b-0">
              <div class="flex justify-between items-center">
                <div>
                  <h3 class="font-medium text-gray-800">{stat.name}</h3>
                  <p class="text-sm text-gray-500">{stat.count} entries</p>
                </div>
                <div class="text-right">
                  <p class="text-lg font-semibold text-blue-600">
                    {formatMinutes(stat.totalMinutes)}
                  </p>
                  <p class="text-sm text-gray-500">
                    {Math.floor(stat.totalMinutes / 60)} hours
                  </p>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-gray-500 text-center py-8">No data for {selectedYear}</p>
      {/if}
    </div>

    <!-- Recent Entries -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Recent Entries</h2>
      
      {#if timeLogs.length > 0}
        <div class="space-y-3">
          {#each timeLogs.slice(0, 10) as log}
            {@const button = buttons.find(b => b.id === log.button_id)}
            {#if button}
              <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                <div>
                  <p class="font-medium text-gray-800">{button.name}</p>
                  <p class="text-sm text-gray-500">
                    {dayjs(log.start_time).format('MMM D, YYYY HH:mm')}
                  </p>
                </div>
                {#if log.end_time}
                  {@const duration = Math.floor((new Date(log.end_time).getTime() - new Date(log.start_time).getTime()) / 60000)}
                  <p class="text-sm font-medium text-gray-700">{formatMinutes(duration)}</p>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      {:else}
        <p class="text-gray-500 text-center py-8">No entries yet</p>
      {/if}
    </div>
  </div>

  <BottomNav currentTab="history" />
</div>
