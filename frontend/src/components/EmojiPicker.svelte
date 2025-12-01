<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import 'emoji-picker-element';

  export let value = '';

  const dispatch = createEventDispatcher<{
    select: { emoji: string };
    clear: void;
  }>();

  let showPicker = false;
  let containerRef: HTMLElement | null = null;

  function handleEmojiClick(event: CustomEvent) {
    const emoji = event.detail?.unicode || '';
    value = emoji;
    dispatch('select', { emoji });
    showPicker = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (containerRef && !containerRef.contains(event.target as Node)) {
      showPicker = false;
    }
  }

  function togglePicker() {
    showPicker = !showPicker;
  }

  function clearEmoji() {
    value = '';
    dispatch('clear');
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>

<div class="relative" bind:this={containerRef}>
  <div class="flex gap-2 items-center">
    <button
      type="button"
      on:click={togglePicker}
      class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-lg min-w-[50px] min-h-[42px] flex items-center justify-center"
      aria-label={value ? 'Change emoji' : 'Select emoji'}
    >
      {#if value}
        <span>{value}</span>
      {:else}
        <span class="text-gray-400">Emoji (optional)</span>
      {/if}
    </button>
    {#if value}
      <button
        type="button"
        on:click={clearEmoji}
        class="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Clear emoji"
      >
        <span class="icon-[si--close-circle-duotone]" style="width: 20px; height: 20px;"></span>
      </button>
    {/if}
  </div>
  
  {#if showPicker}
    <div class="absolute z-50 mt-2 shadow-lg rounded-lg">
      <emoji-picker on:emoji-click={handleEmojiClick}></emoji-picker>
    </div>
  {/if}
</div>

<style>
  /* Ensure the picker doesn't overflow on mobile */
  :global(emoji-picker) {
    --num-columns: 8;
    --category-emoji-size: 1.2rem;
    max-width: calc(100vw - 2rem);
  }

  @media (max-width: 640px) {
    :global(emoji-picker) {
      --num-columns: 6;
    }
  }
</style>
