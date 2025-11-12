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
    const startTime = new Date(activeTimer.timestamp).getTime();
    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
  }

  // Calculate today's total time from start/stop event pairs
  $: {
    const today = dayjs().format('YYYY-MM-DD');
    const todayLogs = $timeLogsStore.timeLogs.filter(tl => 
      tl.button_id === button.id && tl.timestamp && tl.timestamp.startsWith(today)
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Calculate time from start/stop pairs
    todayTime = 0;
    let currentStart: typeof todayLogs[0] | null = null;
    
    for (const log of todayLogs) {
      if (log.type === 'start') {
        currentStart = log;
      } else if (log.type === 'stop' && currentStart) {
        const start = new Date(currentStart.timestamp).getTime();
        const end = new Date(log.timestamp).getTime();
        todayTime += Math.floor((end - start) / 60000); // minutes
        currentStart = null;
      }
    }
    
    // Add time for currently active timer
    if (currentStart && isActive && activeTimer?.id === currentStart.id) {
      const start = new Date(currentStart.timestamp).getTime();
      todayTime += Math.floor((Date.now() - start) / 60000);
    }
  }

  onMount(() => {
    // Update elapsed time every second for active timers
    interval = setInterval(() => {
      if (isActive && activeTimer) {
        const startTime = new Date(activeTimer.timestamp).getTime();
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

  function getGoalDifference(): { minutes: number; isPositive: boolean } {
    if (!button.goal_time_minutes) return { minutes: 0, isPositive: false };
    const difference = todayTime - button.goal_time_minutes;
    return {
      minutes: Math.abs(difference),
      isPositive: difference >= 0
    };
  }

  $: goalProgress = getGoalProgress();
  $: goalDifference = getGoalDifference();
</script>

<div class="relative">
  {#if editMode}
    <button
      on:click={handleDelete}
      class="absolute -top-2 -right-2 z-10 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 shadow-lg"
      aria-label="Delete button"
    >
      <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  {/if}
  
  <button
    on:click={handleClick}
    class="relative aspect-square rounded-full p-4 transition-all duration-300 flex flex-col items-center justify-center text-white shadow-lg w-full overflow-visible"
    class:shadow-2xl={isActive}
    class:has-pulse={isActive}
    style="--button-color: {button.color || '#3B82F6'}; background-color: {button.color || '#3B82F6'}"
  >
    <!-- Animated background layer -->
    {#if isActive}
      <div class="pulse-background" style="background-color: {button.color || '#3B82F6'}"></div>
    {/if}

    <!-- Circular progress indicator (clock-like) -->
    {#if button.goal_time_minutes && !editMode}
      <svg class="progress-ring" width="100%" height="100%" viewBox="0 0 120 120">
        <!-- Background circle -->
        <circle
          class="progress-ring-bg"
          stroke="rgba(255, 255, 255, 0.2)"
          stroke-width="3"
          fill="none"
          r="56"
          cx="60"
          cy="60"
        />
        <!-- Progress circle -->
        <circle
          class="progress-ring-circle"
          stroke="rgba(255, 255, 255, 0.9)"
          stroke-width="3"
          fill="none"
          r="56"
          cx="60"
          cy="60"
          style="--progress: {goalProgress}"
        />
      </svg>
    {/if}

  <!-- Button content -->
  <div class="text-center relative z-10">
    {#if button.emoji}
      <div class="text-4xl mb-2">{button.emoji}</div>
    {/if}
    <div class="font-semibold text-lg mb-1">{button.name}</div>
    
    {#if isActive}
      <div class="text-2xl font-mono">{formatTime(elapsedTime)}</div>
    {/if}
    
    {#if button.goal_time_minutes && todayTime > 0}
      <div class="text-sm opacity-90 mt-2" class:text-green-200={goalDifference.isPositive} class:text-red-200={!goalDifference.isPositive}>
        {goalDifference.isPositive ? '+' : '-'}{Math.floor(goalDifference.minutes / 60)}h {goalDifference.minutes % 60}m
      </div>
    {:else if todayTime > 0}
      <div class="text-sm opacity-90 mt-2">
        {Math.floor(todayTime / 60)}h {todayTime % 60}m
      </div>
    {/if}
  </div>
  </button>
</div>

<style>
  .has-pulse {
    background-color: var(--button-color) !important;
  }

  .pulse-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    z-index: 0;
    animation: pulse-scale 1s ease-in-out infinite;
  }

  .progress-ring {
    position: absolute;
    top: 0;
    left: 0;
    transform: rotate(-90deg);
    z-index: 5;
  }

  .progress-ring-circle {
    stroke-dasharray: 351.858; /* 2 * PI * 56 */
    stroke-dashoffset: calc(351.858 - (351.858 * var(--progress) / 100));
    transition: stroke-dashoffset 0.3s ease;
    stroke-linecap: round;
  }

  @keyframes pulse-scale {
    0% {
      transform: scale(1);
    }
    30% {
      transform: scale(1.01);
    }
    40%, 100% {
      transform: scale(1);
    }
  }
</style>
