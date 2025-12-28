<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Timer } from '../types';
  import { activeTimers } from '../stores/timers';
  import TimerButton from './TimerButton.svelte';

  export let timers: Timer[];
  export let editMode = false;

  const dispatch = createEventDispatcher();

  function handleEdit(timer: Timer) {
    dispatch('edit', timer);
  }
</script>

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 relative">
  {#each timers as timer (timer.id)}
    <div class:col-span-2={$activeTimers?.some(t => t.id === timer.id)}>
      <TimerButton 
        {timer}
        {editMode}
        on:edit={() => handleEdit(timer)}
      />
    </div>
  {/each}

  {#if buttons.length === 0}
    <div class="col-span-full text-center py-12 text-gray-500">
      <p class="text-lg mb-2">No tracking buttons yet</p>
      <p class="text-sm">Click "Add Button" to create your first timer</p>
    </div>
  {/if}
</div>
