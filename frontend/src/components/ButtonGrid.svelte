<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Button } from '../types';
  import { timeLogsStore } from '../stores/timelogs';
  import TimerButton from './TimerButton.svelte';

  export let buttons: Button[];
  export let editMode = false;

  const dispatch = createEventDispatcher();

  function handleEdit(button: Button) {
    dispatch('edit', button);
  }
</script>

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 relative">
  {#each buttons as button (button.id)}
    <div class:col-span-2={$timeLogsStore.activeTimers?.some(t => t.button_id === button.id)}>
      <TimerButton 
        {button}
        {editMode}
        on:edit={() => handleEdit(button)}
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
