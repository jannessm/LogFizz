<script lang="ts">
  import { inactiveTargets, targetsStore } from '../stores/targets';
  import type { DailyTarget } from '../types';

  export let onEditTarget: (target: DailyTarget) => void;

  let isExpanded = false;

  function toggleExpanded() {
    isExpanded = !isExpanded;
  }

  async function handleDelete(target: DailyTarget) {
    if (confirm(`Delete target "${target.name}"?`)) {
      await targetsStore.delete(target.id);
    }
  }

  function getWeekdayNames(weekdays: number[]): string {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return weekdays.map(d => dayNames[d]).join(', ');
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

  function getDurationSummary(target: DailyTarget): string {
    // Get unique durations
    const uniqueDurations = [...new Set(target.duration_minutes)];
    
    if (uniqueDurations.length === 1) {
      return formatDuration(uniqueDurations[0]);
    } else {
      // Show range
      const min = Math.min(...target.duration_minutes);
      const max = Math.max(...target.duration_minutes);
      return `${formatDuration(min)} - ${formatDuration(max)}`;
    }
  }
</script>

{#if $inactiveTargets.length > 0}
  <div class="bg-white rounded-lg shadow-sm mb-4 overflow-hidden">
    <!-- Accordion Header -->
    <button
      on:click={toggleExpanded}
      class="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors"
    >
      <div class="flex items-center gap-2">
        <span 
          class="transition-transform duration-200 icon-[si--arrow-right-square-duotone] text-gray-600"
          class:rotate-90={isExpanded}
          style="width: 20px; height: 20px;"
        ></span>
        <h3 class="text-sm font-semibold text-gray-700">
          Inactive Targets ({$inactiveTargets.length})
        </h3>
      </div>
      <span class="text-xs text-gray-500">
        {isExpanded ? 'Collapse' : 'Expand'}
      </span>
    </button>

    <!-- Accordion Content -->
    {#if isExpanded}
      <div class="border-t border-gray-200 px-4 py-3 space-y-2">
        {#each $inactiveTargets as target}
          <div class="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <h4 class="font-medium text-gray-800 text-sm">{target.name}</h4>
                <div class="text-xs text-gray-600 mt-1 space-y-0.5">
                  <p>
                    <span class="font-medium">Duration:</span>
                    {getDurationSummary(target)}
                  </p>
                  <p>
                    <span class="font-medium">Days:</span>
                    {getWeekdayNames(target.weekdays)}
                  </p>
                </div>
              </div>
              <div class="flex gap-1 ml-2">
                <button
                  on:click={() => onEditTarget(target)}
                  class="p-1 text-blue-600 hover:text-blue-700 icon-[si--edit-detailed-duotone]"
                  style="width: 18px; height: 18px;"
                  aria-label="Edit Target"
                ></button>
                <button
                  on:click={() => handleDelete(target)}
                  class="p-1 text-red-600 hover:text-red-700 icon-[si--bin-duotone]"
                  style="width: 18px; height: 18px;"
                  aria-label="Delete Target"
                ></button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
