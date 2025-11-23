<script lang="ts">
  import { buttonsStore } from '../stores/buttons';
  import { targetsStore } from '../stores/targets';
  import { timeLogsStore } from '../stores/timelogs';
  import type { Button, DailyTarget } from '../types';
  import dayjs from 'dayjs';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let onEditButton: (button: Button) => void;
  export let onEditTarget: (target: DailyTarget) => void;
  export let onAddButton: () => void;
  export let onAddTarget: () => void;

  function handleClose() {
    dispatch('close');
  }

  function handleShowAddTarget() {
    onAddTarget();
  }

  function handleShowAddButton() {
    onAddButton();
  }

  async function handleDeleteButton(button: Button) {
    if (confirm(`Delete button "${button.name}"?`)) {
      await buttonsStore.delete(button.id);
    }
  }

  async function handleDeleteTarget(target: DailyTarget) {
    if (confirm(`Delete target "${target.name}"?`)) {
      await targetsStore.delete(target.id);
    }
  }

  // Calculate progress for each target
  function calculateTargetProgress(target: DailyTarget) {
    const assignedButtons = $buttonsStore.buttons.filter(b => b.target_id === target.id);
    const todayStart = dayjs().startOf('day');
    const todayEnd = dayjs().endOf('day');
    
    let totalMinutes = 0;
    
    for (const button of assignedButtons) {
      const buttonLogs = $timeLogsStore.timeLogs.filter(log => 
        log.button_id === button.id &&
        dayjs(log.timestamp).isAfter(todayStart) &&
        dayjs(log.timestamp).isBefore(todayEnd)
      );
      
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
    
    const today = new Date().getDay();
    const todayIndex = target.weekdays.indexOf(today);
    const targetDuration = todayIndex >= 0 ? target.duration_minutes[todayIndex] : (target.duration_minutes[0] || 60);
    
    const percentage = Math.min(100, Math.round((totalMinutes / targetDuration) * 100));
    
    return { totalMinutes, targetDuration, percentage };
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

  function getWeekdayNames(weekdays: number[]): string {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return weekdays.map(d => dayNames[d]).join(', ');
  }
</script>

<!-- Modal Overlay -->
<div 
  class="fixed inset-0 z-50 flex items-center justify-center p-4"
  on:click={handleClose}
  on:keydown={(e) => e.key === 'Escape' && handleClose()}
  role="button"
  tabindex="0"
>
  <!-- Modal Content -->
  <div 
    class="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
    on:click|stopPropagation
    on:keydown|stopPropagation
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
      <h2 class="text-xl font-semibold text-gray-800">Edit Buttons & Targets</h2>
      <div class="flex gap-2">
        <button
          on:click={handleClose}
          class="text-gray-400 hover:text-gray-600 transition-colors icon-[si--close-circle-duotone]"
          style="width: 28px; height: 28px;"
          aria-label="Close"
        ></button>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="overflow-y-auto flex-1 p-6 space-y-6">
      <!-- Targets Section -->
      <div>
        <div class="flex justify-between items-center mb-2">
            <h3 class="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span class="bg-green-600 icon-[si--clipboard-check-alt-duotone]" style="width: 24px; height: 24px;"></span>
              Targets
            </h3>
            <button
                on:click={handleShowAddTarget}
                class="icon-[si--add-circle-duotone] bg-blue-400 hover:bg-blue-600"
                aria-label="Add"
                style="width: 24px; height: 24px;"
            ></button>
        </div>
        
        {#if $targetsStore.length === 0}
          <p class="text-gray-500 text-sm italic">No targets yet</p>
        {:else}
          <div class="space-y-2">
            {#each $targetsStore as target}
              {@const progress = calculateTargetProgress(target)}
              <div class="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
                <div class="flex justify-between items-center mb-2">
                  <h4 class="font-medium text-gray-800">{target.name}</h4>
                  <div class="flex gap-1">
                    <button
                      on:click={() => onEditTarget(target)}
                      class="p-1 text-blue-600 hover:text-blue-700 icon-[si--edit-detailed-duotone]"
                      style="width: 20px; height: 20px;"
                      aria-label="Edit Target"
                    ></button>
                    <button
                      on:click={() => handleDeleteTarget(target)}
                      class="p-1 text-red-600 hover:text-red-700 icon-[si--bin-duotone]"
                      style="width: 20px; height: 20px;"
                      aria-label="Delete Target"
                    ></button>
                  </div>
                </div>
                
                <!-- Progress bar -->
                <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-1">
                  <div
                    class="h-full rounded-full transition-all duration-500 bg-blue-500"
                    style="width: {progress.percentage}%"
                  ></div>
                </div>
                
                <div class="flex justify-between items-center text-xs">
                  <span class="text-gray-500">
                    {progress.percentage}% ({formatDuration(progress.totalMinutes)} / {formatDuration(progress.targetDuration)})
                  </span>
                  <span class="text-gray-400">{getWeekdayNames(target.weekdays)}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Buttons Section -->
      <div>
        <div class="flex justify-between items-center mb-2">
            <h3 class="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span class="bg-blue-500 icon-[si--clock-alt-duotone]" style="width: 24px; height: 24px;"></span>
              Buttons
            </h3>
            <button
                on:click={handleShowAddButton}
                class="icon-[si--add-circle-duotone] bg-blue-400 hover:bg-blue-600"
                aria-label="Add"
                style="width: 24px; height: 24px;"
            ></button>
        </div>
        
        {#if $buttonsStore.buttons.length === 0}
          <p class="text-gray-500 text-sm italic">No buttons yet</p>
        {:else}
          <div class="space-y-2">
            {#each $buttonsStore.buttons as button}
              <div class="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-3 flex-1">
                    <div 
                      class="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                      style="background-color: {button.color || '#3B82F6'};"
                    >
                      {button.emoji || '⏱️'}
                    </div>
                    <div>
                      <h4 class="font-medium text-gray-800">{button.name}</h4>
                      <div class="text-xs text-gray-500 flex gap-2">
                        {#if button.auto_subtract_breaks}
                          <span class="flex items-center gap-1">
                            <span class="icon-[proicons--coffee-hot]" style="width: 12px; height: 12px;"></span>
                            Auto breaks
                          </span>
                        {/if}
                        {#if button.target_id}
                          {@const linkedTarget = $targetsStore.find(t => t.id === button.target_id)}
                          {#if linkedTarget}
                            <span class="flex items-center gap-1">
                              <span class="icon-[proicons--link]" style="width: 12px; height: 12px;"></span>
                              {linkedTarget.name}
                            </span>
                          {/if}
                        {/if}
                      </div>
                    </div>
                  </div>
                  <div class="flex gap-1">
                    <button
                      on:click={() => onEditButton(button)}
                      class="p-1 text-blue-600 hover:text-blue-700 icon-[si--edit-detailed-duotone]"
                      style="width: 20px; height: 20px;"
                      aria-label="Edit Button"
                    ></button>
                    <button
                      on:click={() => handleDeleteButton(button)}
                      class="p-1 text-red-600 hover:text-red-700 icon-[si--bin-duotone]"
                      style="width: 20px; height: 20px;"
                      aria-label="Delete Button"
                    ></button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  /* Add backdrop blur effect */
  div[role="button"] {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
