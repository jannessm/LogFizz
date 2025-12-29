<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { todayTargets } from '../stores/targets';
  import { timersStore } from '../stores/timers';
  import { timeLogsStore } from '../stores/timelogs';
  import { activeTimeLogs } from '../stores/timelogs';
  import type { TargetWithSpecs } from '../types';
  import dayjs from 'dayjs';
  import { getActiveTargetSpec } from '../lib/utils/targetSpec';

  let activeTargets: TargetWithSpecs[] = [];
  let inactiveTargets: TargetWithSpecs[] = [];
  let displayedTargets: TargetWithSpecs[] = [];
  let progressMap = new Map<string, { totalMinutes: number; targetDuration: number; percentage: number; completed: boolean }>();
  let interval: number | null = null;

  $: if ($todayTargets.length > 0 && $timersStore.items && $timeLogsStore.items) {
    updateProgressMap();
    
    // Separate active and inactive targets
    activeTargets = $todayTargets.filter(t => isTargetActive(t));
    inactiveTargets = $todayTargets.filter(t => !isTargetActive(t));
    
    // Sort active targets by progress (descending)
    activeTargets.sort((a, b) => {
      const progressA = progressMap.get(a.id)?.percentage || 0;
      const progressB = progressMap.get(b.id)?.percentage || 0;
      return progressB - progressA;
    });
    
    // Sort inactive targets by progress (descending)
    inactiveTargets.sort((a, b) => {
      const progressA = progressMap.get(a.id)?.percentage || 0;
      const progressB = progressMap.get(b.id)?.percentage || 0;
      return progressB - progressA;
    });
    
    // Determine which targets to display
    // Show all active targets, or 2 targets (whichever is more)
    const minTargetsToShow = 2;
    if (activeTargets.length >= minTargetsToShow) {
      // Show all active targets
      displayedTargets = [...activeTargets];
    } else {
      // Show first 2 targets (active first, then inactive)
      const allSortedTargets = [...activeTargets, ...inactiveTargets];
      displayedTargets = allSortedTargets.slice(0, minTargetsToShow);
    }
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
  function isTargetActive(target: TargetWithSpecs): boolean {
    // Find all buttons assigned to this target
    const assignedButtons = $timersStore.items.filter(b => b.target_id === target.id);
    
    // Check if any of these buttons have active timers
    return assignedButtons.some(button => 
      $activeTimeLogs.some(timer => timer.timer_id === button.id)
    );
  }

  // Calculate progress for each target
  function calculateTargetProgress(target: TargetWithSpecs) {
    // Find all buttons assigned to this target
    const assignedButtons = $timersStore.items.filter(b => b.target_id === target.id);
    
    // Get today's start/end
    const todayStart = dayjs().startOf('day');
    const todayEnd = dayjs().endOf('day');
    
    // Calculate total minutes from all assigned buttons today
    let totalMinutes = 0;
    
    for (const button of assignedButtons) {
      // Get today's logs for this button
      const buttonLogs = $timeLogsStore.items.filter(log => 
        log.timer_id === button.id &&
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
    // Get active target spec for today
    const activeSpec = getActiveTargetSpec(target);
    const today = new Date().getDay();
    const todayIndex = activeSpec?.weekdays.indexOf(today) ?? -1;
    const targetDuration = todayIndex >= 0 && activeSpec ? activeSpec.duration_minutes[todayIndex] : (activeSpec?.duration_minutes[0] || 60);
    
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

{#if displayedTargets.length > 0}
  <div class="px-4 mb-4 z-0">
    {#each displayedTargets as target}
      {@const progress = progressMap.get(target.id)}
      {@const isActive = isTargetActive(target)}
      {#if progress}
        <div 
          class="flex justify-between items-start gap-4 transition-opacity duration-300"
          class:opacity-100={isActive}
          class:opacity-40={!isActive}
        >
          <p 
            class="shrink-0 transition-colors duration-300"
            class:text-gray-800={isActive}
            class:text-gray-500={!isActive}
          >
            {target.name}
          </p>
          <div class="w-full flex flex-col items-end">
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden mt-2 mb-1">
              <div
                class="h-full rounded-full transition-all duration-500"
                class:bg-green-500={isActive && progress.completed}
                class:bg-blue-500={isActive && !progress.completed}
                class:bg-gray-400={!isActive}
                style="width: {progress.percentage}%"
              ></div>
            </div>
            <div 
              class="text-xs transition-colors duration-300 text-gray-500"
            >
              {isActive ? Math.ceil(progress.percentage) : progress.percentage}% ({formatDuration(progress.totalMinutes)} / {formatDuration(progress.targetDuration)})
            </div>
          </div>
        </div>
      {/if}
    {/each}
  </div>
{/if}
