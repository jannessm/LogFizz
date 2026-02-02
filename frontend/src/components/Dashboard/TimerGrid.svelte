<script lang="ts">
  import type { Timer } from '../../types';
  import { activeTimers } from '../../stores/timers';
  import TimerButton from './TimerButton.svelte';
  import { _ } from '../../lib/i18n';

  let {
    timers,
    editMode = false,
    edit
  }: {
    timers: Timer[];
    editMode?: boolean;
    edit: (timer: Timer) => void;
  } = $props();
</script>

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 relative">
  {#each timers as timer (timer.id)}
    <div class:col-span-2={$activeTimers?.some(t => t.id === timer.id)}>
      <TimerButton 
        {timer}
        {editMode}
        {edit}
      />
    </div>
  {/each}

  {#if timers.length === 0}
    <div class="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
      <p class="text-lg mb-2">{$_('dashboard.noTrackingButtons')}</p>
      <p class="text-sm">{$_('dashboard.clickAddTimer')}</p>
    </div>
  {/if}
</div>
