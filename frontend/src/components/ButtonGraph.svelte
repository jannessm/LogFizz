<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import type { Button } from '../types';
  import { timeLogsStore } from '../stores/timelogs';
  import { computeButtonLayout } from '../lib/buttonLayout';
  import TimerButton from './TimerButton.svelte';

  export let buttons: Button[];
  export let editMode = false;

  const dispatch = createEventDispatcher();

  let containerWidth = 500;
  let containerHeight = 600;
  let containerEl: HTMLDivElement;

  // Compute button positions based on transition graph
  $: buttonPositions = computeButtonLayout(buttons, $timeLogsStore.timeLogs, containerWidth, containerHeight);

  function handleEdit(button: Button) {
    dispatch('edit', button);
  }

  onMount(() => {
    if (containerEl) {
      const rect = containerEl.getBoundingClientRect();
      containerWidth = rect.width || 500;
      containerHeight = Math.max(rect.height || 600, 600);
    }
  });

  afterUpdate(() => {
    if (containerEl && buttons.length > 0) {
      const rect = containerEl.getBoundingClientRect();
      containerWidth = rect.width || 500;
      // Dynamic height based on number of buttons
      containerHeight = Math.max(600, Math.min(1000, 400 + buttons.length * 30));
    }
  });
</script>

<div 
  bind:this={containerEl}
  class="relative w-full min-h-[600px] bg-gray-50 rounded-lg"
  style="height: {containerHeight}px;"
>
  {#if buttons.length === 0}
    <div class="absolute inset-0 flex items-center justify-center text-center py-12 text-gray-500">
      <div>
        <p class="text-lg mb-2">No tracking buttons yet</p>
        <p class="text-sm">Click "Add Button" to create your first timer</p>
      </div>
    </div>
  {:else}
    {#each buttons as button (button.id)}
      {@const position = buttonPositions.get(button.id)}
      {#if position}
        {@const isActive = $timeLogsStore.activeTimer?.button_id === button.id}
        <div
          class="absolute transition-all duration-500 ease-out"
          style="
            left: {position.x}px;
            top: {position.y}px;
            transform: translate(-50%, -50%) scale({isActive ? 1.2 : 1});
            width: {isActive ? 160 : 120}px;
            z-index: {isActive ? 10 : 1};
          "
        >
          <TimerButton 
            {button}
            {editMode}
            on:edit={() => handleEdit(button)}
          />
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  /* Smooth transitions for position changes */
  .absolute {
    will-change: transform, left, top;
  }
</style>
