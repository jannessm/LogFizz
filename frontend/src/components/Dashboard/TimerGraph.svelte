<script lang="ts">
  import { onMount } from 'svelte';
  import type { Timer, TimeLog } from '../../types';
  import { timeLogsStore, timerlogs } from '../../stores/timelogs';
  import { mapToArray } from '../../stores/base-store';
  import { computeTimerLayout } from '../../lib/timerLayout';
  import TimerButton, {
    type ButtonEditCallback,
    type ButtonLongpressCallback,
    type ButtonTimerStoppedCallback
  } from './TimerButton.svelte';

  let { 
    buttons,
    editMode = false,
    toggleMode = true,
    edit,
    longpress,
    timerstopped
  }: {
    buttons: Timer[];
    editMode?: boolean;
    toggleMode?: boolean;
    edit?: ButtonEditCallback;
    longpress?: ButtonLongpressCallback;
    timerstopped?: ButtonTimerStoppedCallback;
  } = $props();

  const timerSize = 150; // Base size of each timer in pixels

  let containerWidth = $state(500);
  let containerHeight = $state(600);
  let containerEl: HTMLDivElement;
  let timerPositions: Map<string, { x: number; y: number }> = $state(new Map());

  onMount(() => {
    if (containerEl) {
      const rect = containerEl.getBoundingClientRect();
      containerWidth = rect.width;
      containerHeight = Math.max(rect.height, 600);
      timerPositions = computeTimerLayout(buttons, mapToArray($timeLogsStore.items), containerWidth, containerHeight, timerSize);
    }
  });

  $effect(() => {
    if (containerEl && buttons.length > 0) {
      const rect = containerEl.getBoundingClientRect();
      containerWidth = rect.width;
      // Dynamic height based on number of buttons
      containerHeight = Math.max(rect.height, Math.min(1000, 400 + buttons.length * 30));
      timerPositions = computeTimerLayout(buttons, mapToArray($timeLogsStore.items), containerWidth, containerHeight, timerSize);
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
        <p class="text-sm">Click "Add Timer" to create your first timer</p>
      </div>
    </div>
  {:else}
    {#each buttons as button (button.id)}
      {@const position = timerPositions.get(button.id)}
      {#if position}
        {@const isActive = $timerlogs.some((t: TimeLog) => t.timer_id === button.id && !t.end_timestamp)}
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
            timer={button}
            {editMode}
            {toggleMode}
            edit={edit}
            longpress={longpress}
            timerstopped={timerstopped}
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
