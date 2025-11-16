<script lang="ts">
  import { todayTargets, targetsStore } from '../stores/targets';
  import { buttonsStore } from '../stores/buttons';
  import { timeLogsStore } from '../stores/timelogs';
  import type { DailyTarget } from '../types';
  import dayjs from 'dayjs';

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
      const buttonLogs = $timeLogsStore.timeLogs.filter(log => 
        log.button_id === button.id &&
        dayjs(log.timestamp).isAfter(todayStart) &&
        dayjs(log.timestamp).isBefore(todayEnd)
      );
      
      // Calculate time from start/stop pairs
      const starts = buttonLogs.filter(log => log.type === 'start').sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const stops = buttonLogs.filter(log => log.type === 'stop').sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      for (let i = 0; i < starts.length; i++) {
        const start = dayjs(starts[i].timestamp);
        const stop = stops[i] ? dayjs(stops[i].timestamp) : dayjs();
        totalMinutes += stop.diff(start, 'minute');
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
    const mins = minutes % 60;
    
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
  <div class="px-4 mb-4">
    {#each $todayTargets as target}
      {@const progress = calculateTargetProgress(target)}
      {@const isActive = isTargetActive(target)}
      <div 
        class="flex justify-between items-start gap-4 transition-opacity duration-300"
        class:opacity-40={!isActive}
        class:opacity-100={isActive}
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
              class:bg-green-500={progress.completed && isActive}
              class:bg-blue-500={!progress.completed && isActive}
              class:bg-gray-400={!isActive}
              style="width: {progress.percentage}%"
            ></div>
          </div>
          <div 
            class="text-xs transition-colors duration-300"
            class:text-gray-500={isActive}
            class:text-gray-400={!isActive}
          >
            {progress.percentage}% ({formatDuration(progress.totalMinutes)} / {formatDuration(progress.targetDuration)})
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}
