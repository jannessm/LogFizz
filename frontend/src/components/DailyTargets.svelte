<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { todayTargets } from '../stores/targets';
  import { buttonsStore } from '../stores/buttons';
  import { timeLogsStore } from '../stores/timelogs';
  import type { DailyTarget } from '../types';
  import dayjs from 'dayjs';

  let activeTargets: DailyTarget[] = [];
  let inactiveTargets: DailyTarget[] = [];
  let progressMap = new Map<string, { totalMinutes: number; targetDuration: number; percentage: number; completed: boolean }>();
  let interval: number | null = null;

  $: if ($todayTargets.length > 0 && $buttonsStore.buttons && $timeLogsStore.timeLogs) {
    activeTargets = $todayTargets.filter(t => isTargetActive(t)).sort((a, b) => a.name.localeCompare(b.name));
    inactiveTargets = $todayTargets.filter(t => !isTargetActive(t)).sort((a, b) => a.name.localeCompare(b.name));
    updateProgressMap();
  }

  function updateProgressMap() {
    const map = new Map<string, { totalMinutes: number; targetDuration: number; percentage: number; completed: boolean }>();
    for (const target of $todayTargets) {
      map.set(target.id, calculateTargetProgress(target));
    }
    progressMap = map;
  }

  onMount(() => {
    // Update progress every second
    interval = setInterval(() => {
      if ($todayTargets.length > 0) {
        updateProgressMap();
      }
    }, 1000) as unknown as number;
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });


  // Check if target is currently active (any assigned button is running)
  function isTargetActive(target: DailyTarget): boolean {
    // Find all buttons assigned to this target
    const assignedButtons = $buttonsStore.buttons.filter(b => b.target_id === target.id);
    
    // Check if any of these buttons have active timers
    return assignedButtons.some(button => 
      $timeLogsStore.activeTimers.some(timer => timer.button_id === button.id)
    );
  }

  // Calculate progress for each target
  function calculateTargetProgress(target: DailyTarget) {
    // Find all buttons assigned to this target
    const assignedButtons = $buttonsStore.buttons.filter(b => b.target_id === target.id);
    
    // Get today's start/end
    const todayStart = dayjs().startOf('day');
    const todayEnd = dayjs().endOf('day');
    
    // Calculate total minutes from all assigned buttons today
    let totalMinutes = 0;
    
    for (const button of assignedButtons) {
      // Get today's logs for this button
      const buttonLogs = $timeLogsStore.timeLogs.filter(log => 
        log.button_id === button.id &&
        log.start_timestamp &&
        dayjs(log.start_timestamp).isAfter(todayStart) &&
        dayjs(log.start_timestamp).isBefore(todayEnd)
      );
      
      // Sum durations from completed sessions
      for (const log of buttonLogs) {
        if (log.end_timestamp) {
          // Use pre-calculated duration if available
          if (log.duration_minutes !== undefined && log.duration_minutes !== null) {
            totalMinutes += log.duration_minutes;
          } else {
            // Calculate from timestamps
            const start = dayjs(log.start_timestamp);
            const end = dayjs(log.end_timestamp);
            totalMinutes += end.diff(start, 'minute', true);
          }
        } else {
          // Active session - calculate from start to now
          const start = dayjs(log.start_timestamp);
          totalMinutes += dayjs().diff(start, 'minute', true);
        }
      }
    }
    
    // Get duration for today's weekday
    // duration_minutes is an array with one value per weekday in target.weekdays
    const today = new Date().getDay();
    const todayIndex = target.weekdays.indexOf(today);
    const targetDuration = todayIndex >= 0 ? target.duration_minutes[todayIndex] : (target.duration_minutes[0] || 60);
    
    const percentage = Math.min(100, Math.round((totalMinutes / targetDuration) * 100));
    const completed = totalMinutes >= targetDuration;

    return {
      totalMinutes,
      targetDuration,
      percentage,
      completed,
    };
  }

  function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.ceil(minutes % 60);
    
    if (hours === 0) {
      return `${mins}m`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}m`;
    }
  }

</script>

{#if $todayTargets.length > 0}
  <div class="px-4 mb-4 z-0">
    {#each activeTargets as target}
      {@const progress = progressMap.get(target.id)}
      {#if progress}
        <div 
          class="flex justify-between items-start gap-4 transition-opacity duration-300 opacity-100"
        >
          <p 
            class="shrink-0 transition-colors duration-300 text-gray-800"
          >
            {target.name}
          </p>
          <div class="w-full flex flex-col items-end">
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden mt-2 mb-1">
              <div
                class="h-full rounded-full transition-all duration-500"
                class:bg-green-500={progress.completed}
                class:bg-blue-500={!progress.completed}
                style="width: {progress.percentage}%"
              ></div>
            </div>
            <div 
              class="text-xs transition-colors duration-300 text-gray-500"
            >
              {Math.ceil(progress.percentage)}% ({formatDuration(progress.totalMinutes)} / {formatDuration(progress.targetDuration)})
            </div>
          </div>
        </div>
      {/if}
    {/each}

    {#each inactiveTargets as target}
      {@const progress = progressMap.get(target.id)}
      {#if progress}
        <div 
          class="flex justify-between items-start gap-4 transition-opacity duration-300 opacity-40"
        >
          <p 
            class="shrink-0 transition-colors duration-300 text-gray-500"
          >
            {target.name}
          </p>
          <div class="w-full flex flex-col items-end">
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden mt-2 mb-1">
              <div
                class="h-full rounded-full transition-all duration-500 bg-gray-400"
                style="width: {progress.percentage}%"
              ></div>
            </div>
            <div 
              class="text-xs transition-colors duration-300 text-gray-500"
            >
              {progress.percentage}% ({formatDuration(progress.totalMinutes)} / {formatDuration(progress.targetDuration)})
            </div>
          </div>
        </div>
      {/if}
    {/each}
  </div>
{/if}
