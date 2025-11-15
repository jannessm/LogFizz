<script lang="ts">
  import { todayTargets, targetsStore } from '../stores/targets';
  import { sortedButtons } from '../stores/buttons';
  import { timeLogsStore } from '../stores/timelogs';
  import type { DailyTarget } from '../types';
  import dayjs from 'dayjs';

  export let onAddTarget: () => void;
  export let onEditTarget: (target: DailyTarget) => void;

  // Calculate progress for each target
  function calculateTargetProgress(target: DailyTarget) {
    // Find all buttons assigned to this target
    const assignedButtons = $sortedButtons.filter(b => b.target_id === target.id);
    
    // Get today's start/end
    const todayStart = dayjs().startOf('day');
    const todayEnd = dayjs().endOf('day');
    
    // Calculate total minutes from all assigned buttons today
    let totalMinutes = 0;
    
    for (const button of assignedButtons) {
      const buttonLogs = $timeLogsStore.filter(log => 
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

  async function handleDelete(target: DailyTarget) {
    if (confirm(`Delete target "${target.name}"?`)) {
      await targetsStore.delete(target.id);
    }
  }
</script>

{#if $todayTargets.length > 0}
  <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
    <div class="flex justify-between items-center mb-3">
      <h3 class="text-lg font-semibold text-gray-800">Today's Targets</h3>
      <button
        on:click={onAddTarget}
        class="p-1 text-blue-600 hover:text-blue-700 icon-[si--add-circle-duotone]"
        style="width: 24px; height: 24px;"
        aria-label="Add Target"
      ></button>
    </div>

    <div class="space-y-3">
      {#each $todayTargets as target}
        {@const progress = calculateTargetProgress(target)}
        <div class="border border-gray-200 rounded-lg p-3">
          <div class="flex justify-between items-start mb-2">
            <div class="flex-1">
              <h4 class="font-medium text-gray-800">{target.name}</h4>
              <p class="text-sm text-gray-600">
                {formatDuration(progress.totalMinutes)} / {formatDuration(progress.targetDuration)}
              </p>
            </div>
            <div class="flex gap-1">
              <button
                on:click={() => onEditTarget(target)}
                class="p-1 text-blue-600 hover:text-blue-700 icon-[si--edit-detailed-duotone]"
                style="width: 20px; height: 20px;"
                aria-label="Edit Target"
              ></button>
              <button
                on:click={() => handleDelete(target)}
                class="p-1 text-red-600 hover:text-red-700 icon-[si--delete-duotone]"
                style="width: 20px; height: 20px;"
                aria-label="Delete Target"
              ></button>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              class:bg-green-500={progress.completed}
              class:bg-blue-500={!progress.completed}
              style="width: {progress.percentage}%"
            ></div>
          </div>
          <div class="text-xs text-gray-500 mt-1 text-right">
            {progress.percentage}% complete
          </div>
        </div>
      {/each}
    </div>
  </div>
{:else}
  <div class="bg-white rounded-lg shadow-sm p-4 mb-4 border-2 border-dashed border-gray-300">
    <div class="text-center">
      <p class="text-gray-600 mb-2">No targets for today</p>
      <button
        on:click={onAddTarget}
        class="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 mx-auto"
      >
        <span class="icon-[si--add-circle-duotone]" style="width: 16px; height: 16px;"></span>
        Add a target
      </button>
    </div>
  </div>
{/if}
