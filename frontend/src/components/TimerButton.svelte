<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { Button } from '../types';
  import { timeLogsStore } from '../stores/timelogs';
  import { buttonsStore } from '../stores/buttons';
  import dayjs from 'dayjs';

  export let button: Button;
  export let editMode = false;

  const dispatch = createEventDispatcher();

  let isActive = false;
  let elapsedTime = 0;
  let todayTime = 0;
  let interval: number | null = null;

  $: activeTimer = $timeLogsStore.activeTimer;
  $: isActive = activeTimer?.button_id === button.id;

  // Calculate elapsed time for active timer
  $: if (isActive && activeTimer) {
    const startTime = new Date(activeTimer.start_time).getTime();
    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
  }

  // Calculate today's total time
  $: {
    const today = dayjs().format('YYYY-MM-DD');
    const todayLogs = $timeLogsStore.timeLogs.filter(tl => 
      tl.button_id === button.id && tl.start_time.startsWith(today)
    );
    todayTime = todayLogs.reduce((total, tl) => {
      if (tl.end_time) {
        const start = new Date(tl.start_time).getTime();
        const end = new Date(tl.end_time).getTime();
        return total + Math.floor((end - start) / 60000); // minutes
      }
      return total;
    }, 0);
  }

  onMount(() => {
    // Update elapsed time every second for active timers
    interval = setInterval(() => {
      if (isActive && activeTimer) {
        const startTime = new Date(activeTimer.start_time).getTime();
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
      }
    }, 1000) as unknown as number;
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  async function handleClick() {
    if (editMode) {
      dispatch('edit');
      return;
    }

    if (isActive && activeTimer) {
      // Stop timer
      await timeLogsStore.stopTimer(activeTimer.id);
    } else {
      // Start timer
      await timeLogsStore.startTimer(button.id);
    }
  }

  async function handleDelete() {
    if (confirm(`Delete "${button.name}"?`)) {
      await buttonsStore.delete(button.id);
    }
  }

  function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function getGoalProgress(): number {
    if (!button.goal_time_minutes) return 0;
    return Math.min(100, (todayTime / button.goal_time_minutes) * 100);
  }

  $: goalProgress = getGoalProgress();
</script>

<div class="relative">
  {#if editMode}
    <button
      on:click={handleDelete}
      class="absolute -top-2 -right-2 z-10 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 shadow-lg"
    >
      <span class="text-white text-lg font-bold">×</span>
    </button>
  {/if}
  
  <button
    on:click={handleClick}
    class="relative aspect-square rounded-2xl p-4 transition-all duration-300 flex flex-col items-center justify-center text-white shadow-lg w-full"
    class:scale-110={isActive}
    class:shadow-2xl={isActive}
    style="background-color: {button.color || '#3B82F6'}"
  >

  <!-- Button content -->
  <div class="text-center">
    {#if button.emoji}
      <div class="text-4xl mb-2">{button.emoji}</div>
    {/if}
    <div class="font-semibold text-lg mb-1">{button.name}</div>
    
    {#if isActive}
      <div class="text-2xl font-mono">{formatTime(elapsedTime)}</div>
    {/if}
    
    {#if todayTime > 0}
      <div class="text-sm opacity-90 mt-2">
        Today: {Math.floor(todayTime / 60)}h {todayTime % 60}m
      </div>
    {/if}
  </div>

  <!-- Goal progress bar -->
  {#if button.goal_time_minutes && !editMode}
    <div class="absolute bottom-2 left-2 right-2 h-1 bg-white bg-opacity-30 rounded-full overflow-hidden">
      <div 
        class="h-full bg-white transition-all duration-300"
        style="width: {goalProgress}%"
      ></div>
    </div>
  {/if}

    <!-- Active indicator -->
    {#if isActive}
      <div class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
    {/if}
  </button>
</div>
