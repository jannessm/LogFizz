<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { Button } from '../types';
  import { timeLogsStore } from '../stores/timelogs';
  import { buttonsStore } from '../stores/buttons';
  import dayjs from 'dayjs';

  export let button: Button;
  export let editMode = false;
  export let toggleMode = true;

  const dispatch = createEventDispatcher();

  let isActive = false;
  let elapsedTime = 0;
  let todayTime = 0;
  let interval: number | null = null;

  $: activeTimer = $timeLogsStore.activeTimers.filter(t => t.button_id === button.id)[0];
  $: isActive = activeTimer !== undefined;

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
      if (toggleMode) {
        // Stop any other active timers first
        const otherActiveTimers = $timeLogsStore.activeTimers.filter(t => t.button_id !== button.id);
        for (const timer of otherActiveTimers) {
          await timeLogsStore.stopTimer(timer.id);
        }
      }
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
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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
      class="absolute -top-2 -right-2 z-10 w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center hover:bg-gray-600 icon-[si--edit-detailed-duotone]"
      aria-label="Edit button"
    ></button>
  {/if}
  
  <button
    on:click={handleClick}
    class="relative aspect-square p-4 transition-all duration-300 flex flex-col items-center justify-center text-white w-full overflow-visible min-w-[150px] min-h-[150px] rounded-full"
    class:has-pulse={isActive}
    style="--button-color: {button.color || '#3B82F6'}; background-color: {button.color || '#3B82F6'}"
  >
    <!-- Animated background layer -->
    {#if isActive}
      <div class="pulse-background" style="background-color: {button.color || '#3B82F6'}"></div>
    {/if}

    <!-- Circular progress indicator for seconds (when active) -->
    {#if isActive && !editMode}
      <svg class="progress-ring-seconds" width="100%" height="100%" viewBox="0 0 120 120">
        <!-- Background circle -->
        <circle
          class="progress-ring-bg"
          stroke="rgba(255, 255, 255, 0.15)"
          stroke-width="4"
          fill="none"
          r="56"
          cx="60"
          cy="60"
        />
        <!-- Seconds progress circle -->
        <circle
          class="progress-ring-seconds-circle"
          stroke="rgba(255, 255, 255, 0.95)"
          stroke-width="4"
          fill="none"
          r="56"
          cx="60"
          cy="60"
          style="--seconds-progress: {(elapsedTime % 60) / 60 * 100}"
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
    
    {#if todayTime > 0}
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

  .progress-ring-seconds {
    position: absolute;
    top: 0;
    left: 0;
    transform: rotate(-90deg);
    z-index: 5;
  }

  .progress-ring-seconds-circle {
    stroke-dasharray: 351.858; /* 2 * PI * 56 */
    stroke-dashoffset: calc(351.858 - (351.858 * var(--seconds-progress) / 100));
    transition: stroke-dashoffset 0.1s linear;
    stroke-linecap: round;
  }

  @keyframes pulse-scale {
    0% {
      transform: scale(1.02);
    }
    10% {
      transform: scale(1);
    }
    70% {
      transform: scale(1);
    }
    100% {
      transform: scale(1.02);
    }
  }
</style>
