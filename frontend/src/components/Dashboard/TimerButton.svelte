<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { dayjs, type Timer, type TimeLog } from '../../types';
  import { timeLogsStore, timerlogs, activeTimeLogs } from '../../stores/timelogs';
  import { timersStore } from '../../stores/timers';
  import { formatTime } from '../../../../lib/utils/timeFormat.js';
  import { _ } from '../../lib/i18n';
  import { get } from 'svelte/store';
    import { formatMinutesCompact } from '../../../../lib/dist/utils/timeFormat';

  export type ButtonEditCallback = (timer: Timer) => void;
  export type ButtonLongpressCallback = (timer: Timer, timelog: TimeLog | undefined, isActive: boolean) => void;
  export type ButtonTimerStoppedCallback = (timelog: TimeLog, timer: Timer) => void;

  let {
    timer,
    editMode = false,
    toggleMode = true,
    edit = () => {},
    longpress = () => {},
    timerstopped = () => {},
  }: {
    timer: Timer;
    editMode?: boolean;
    toggleMode?: boolean;
    edit?: ButtonEditCallback;
    longpress?: ButtonLongpressCallback;
    timerstopped?: ButtonTimerStoppedCallback;
  } = $props();

  let elapsedTime = $state(0); // in seconds
  let strokeDashoffset = $state(351.858); // 2 * PI * 56
  let interval: number | null = null;
  let longPressTimer: number | null = null;
  let isLongPressTriggered = false;

  let activeTimeLog = $derived($activeTimeLogs.find(t => t.timer_id === timer.id));
  let isActive = $state(false);

  let todayTime = $state(0); // in minutes

  $effect(() => {
    activeTimeLog = $activeTimeLogs.find(t => t.timer_id === timer.id);
    // Calculate elapsed time for active timer
    if (activeTimeLog) {
      isActive = true;
      updateProgress();
    } else {
      isActive = false;
      elapsedTime = 0;
      strokeDashoffset = 351.858; // reset
    }
  });

  $effect(() => {
    // Calculate today's total time from completed timelogs
    const today = dayjs().format('YYYY-MM-DD');
    const todayLogs = $timerlogs.filter(tl => 
      tl.timer_id === timer.id && tl.start_timestamp && tl.start_timestamp.startsWith(today)
    );
    
    // Sum up durations from completed logs
    let _todayTime = 0;
    for (const log of todayLogs) {
      if (log.end_timestamp && log.duration_minutes) {
        _todayTime += log.duration_minutes;
      } else if (log.end_timestamp) {
        // Calculate if duration wasn't stored
        const start = new Date(log.start_timestamp).getTime();
        const end = new Date(log.end_timestamp).getTime();
        _todayTime += Math.floor((end - start) / 60000);
      }
    }
    
    // Add time for currently active timer
    if (isActive && activeTimeLog && activeTimeLog.start_timestamp.startsWith(today)) {
      const start = new Date(activeTimeLog.start_timestamp).getTime();
      _todayTime += Math.floor((Date.now() - start) / 60000);
    }
    todayTime = _todayTime;
  });

  onMount(() => {
    // Update elapsed time every second for active timers
    interval = setInterval(updateProgress, 1000) as unknown as number;
  });

  function updateProgress() {
    if (isActive && activeTimeLog) {
      const startTime = dayjs(activeTimeLog.start_timestamp).valueOf();
      elapsedTime = Math.floor((dayjs().valueOf() - startTime) / 1000);
      
      // Calculate stroke-dashoffset directly for Firefox compatibility
      const secProgress = (elapsedTime % 60) / 60;
      const circumference = 351.858; // 2 * PI * 56
      strokeDashoffset = circumference - (circumference * secProgress);
    }
  }

  onDestroy(() => {
    if (interval) clearInterval(interval);
    if (longPressTimer) clearTimeout(longPressTimer);
  });

  function handlePointerDown() {
    isLongPressTriggered = false;
    longPressTimer = setTimeout(() => {
      isLongPressTriggered = true;
      longpress(timer, activeTimeLog, isActive);
    }, 500) as unknown as number;
  }

  function handlePointerUp() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  async function handleClick() {
    // Don't trigger click if long press was triggered
    if (isLongPressTriggered) {
      isLongPressTriggered = false;
      return;
    }

    if (editMode) {
      edit(timer);
      return;
    }

    if (isActive && activeTimeLog) {
      // Stop timer - dispatch event before stopping to allow parent to intercept
      timerstopped(activeTimeLog, timer);
    } else {
      if (toggleMode) {
        // Stop any other active timers first
        const otherActiveTimers = $activeTimeLogs.filter(t => t.timer_id !== timer.id);
        for (const otherTimer of otherActiveTimers) {
          await timeLogsStore.stopTimer(otherTimer);
        }
      }
      // Start timer
      await timeLogsStore.startTimer(timer);
    }
  }

  async function handleDelete() {
    if (confirm(get(_)('timer.deleteTimer') + ` "${timer.name}"?`)) {
      await timersStore.delete(timer);
    }
  }
</script>

<div class="relative">
  {#if editMode}
    <button
      onclick={handleDelete}
      class="absolute -top-2 -right-2 z-10 w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center hover:bg-gray-600 icon-[si--edit-detailed-duotone]"
      aria-label={$_('timer.editButton')}
    ></button>
  {/if}
  
  <button
    onclick={handleClick}
    onpointerdown={handlePointerDown}
    onpointerup={handlePointerUp}
    onpointerleave={handlePointerUp}
    class="relative aspect-square p-4 transition-all duration-300 flex flex-col items-center justify-center text-white w-full overflow-visible min-w-[150px] min-h-[150px] rounded-full"
    class:has-pulse={isActive}
    style="--button-color: {timer.color || '#3B82F6'}; background-color: {timer.color || '#3B82F6'}"
  >
    <!-- Animated background layer -->
    {#if isActive}
      <div class="pulse-background" style="background-color: {timer.color || '#3B82F6'}"></div>
    {/if}

    <!-- Circular progress indicator for seconds (when active) -->
    {#if isActive && !editMode}
      <svg 
        class="progress-ring-seconds" 
        width="100%" 
        height="100%" 
        viewBox="0 0 120 120"
        preserveAspectRatio="xMidYMid meet"
        role="presentation"
      >
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
          stroke-width="3"
          fill="none"
          r="56"
          cx="60"
          cy="60"
          stroke-dashoffset={strokeDashoffset}
        />
      </svg>
    {/if}

  <!-- Button content -->
  <div class="text-center relative z-10">
    {#if timer.emoji}
      <div class="text-4xl mb-2">{timer.emoji}</div>
    {/if}
    <div class="font-semibold text-lg mb-1">{timer.name}</div>
    
    {#if isActive}
      <div class="text-2xl font-mono">{formatTime(elapsedTime)}</div>
    {/if}
    
    {#if todayTime > 0}
      <div class="text-sm opacity-90 mt-2">
        {formatMinutesCompact(todayTime)}
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
    transform-origin: center;
    z-index: 5;
    /* Ensure smooth rendering across browsers */
    will-change: transform;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .progress-ring-bg {
    /* Ensure consistent rendering */
    vector-effect: non-scaling-stroke;
  }

  .progress-ring-seconds-circle {
    stroke-dasharray: 351.858; /* 2 * PI * 56 */
    /* Cross-browser transitions */
    transition: stroke-dashoffset 0.1s linear;
    -webkit-transition: stroke-dashoffset 0.1s linear;
    -moz-transition: stroke-dashoffset 0.1s linear;
    -ms-transition: stroke-dashoffset 0.1s linear;
    -o-transition: stroke-dashoffset 0.1s linear;
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
