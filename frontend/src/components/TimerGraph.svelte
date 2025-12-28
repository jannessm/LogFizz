<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import type { Timer } from '../types';
  import { timeLogsStore } from '../stores/timelogs';
  import { computeTimerLayout } from '../lib/timerLayout';
  import TimerButton from './TimerButton.svelte';

  export let buttons: Timer[];
  export let editMode = false;
  export let toggleMode = true;

  const dispatch = createEventDispatcher();
  const timerSize = 150; // Base size of each timer in pixels

  let containerWidth = 500;
  let containerHeight = 600;
  let containerEl: HTMLDivElement;

  // Compute timer positions based on transition graph
  $: timerPositions = computeTimerLayout(buttons, $timeLogsStore.items, containerWidth, containerHeight, timerSize);

  function handleEdit(button: Timer) {
    dispatch('edit', button);
  }

  function handleLongPress(event: CustomEvent) {
    dispatch('longpress', event.detail);
  }

  function handleTimerStopped(event: CustomEvent) {
    dispatch('timerstopped', event.detail);
  }

  onMount(() => {
    if (containerEl) {
      const rect = containerEl.getBoundingClientRect();
      containerWidth = rect.width;
      containerHeight = Math.max(rect.height, 600);
    }
  });

  afterUpdate(() => {
    if (containerEl && buttons.length > 0) {
      const rect = containerEl.getBoundingClientRect();
      containerWidth = rect.width;
      // Dynamic height based on number of buttons
      containerHeight = Math.max(rect.height, Math.min(1000, 400 + buttons.length * 30));
    }
  });
</script>

<div 
  bind:this={containerEl}
  class="relative w-full h-full"
  style="min-height: 600px; height: 100%;"
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
      {@const position = timerPositions.get(button.id)}
      {#if position}
        {@const isActive = $timeLogsStore.items.some(t => t.timer_id === button.id && !t.end_timestamp)}
        <div
          class="absolute transition-all duration-500 ease-out rounded-full drop-shadow-lg"
          class:drop-shadow-2xl={isActive}
          class:drop-shadow-stone-700={isActive}
          style="
            left: {position.x}px;
            top: {position.y}px;
            transform: translate(-50%, -50%) scale({isActive ? 1.2 : 1});
            width: {isActive ? timerSize * 1.2 : timerSize}px;
            z-index: {isActive ? 10 : 1};
          "
        >
          <TimerButton 
            {button}
            {editMode}
            {toggleMode}
            on:edit={() => handleEdit(button)}
            on:longpress={handleLongPress}
            on:timerstopped={handleTimerStopped}
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
