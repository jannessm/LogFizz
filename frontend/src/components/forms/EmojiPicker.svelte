<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { _ } from '../../lib/i18n';

  let {
    value = '',
    select,
    clear
  }: {
    value: string;
    select?: (emoji: string) => void;
    clear?: () => void;
  } = $props();

  let showPicker = $state(false);
  let containerRef: HTMLElement | null = null;

  $effect(() => {
    if (showPicker) {
      // Lazy load the emoji picker library
      setTimeout(() => {
        document.querySelector('emoji-picker')?.addEventListener('emoji-click', (e: any) => handleEmojiClick(e));
      }, 100);
    }
  });

  function handleEmojiClick(event: CustomEvent) {
    const emoji = event.detail?.unicode || '';
    value = emoji;
    select && select(emoji);
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
    clear && clear();
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
      onclick={togglePicker}
      class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-lg min-w-[50px] min-h-[42px] flex items-center justify-center bg-white dark:bg-gray-700"
      aria-label={value ? 'Change emoji' : 'Select emoji'}
    >
      {#if value}
        <span>{value}</span>
      {:else}
        <span class="text-gray-400 dark:text-gray-500">{$_('timer.emojiOptional')}</span>
      {/if}
    </button>
    {#if value}
      <button
        type="button"
        onclick={clearEmoji}
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label={$_('timer.clearEmoji')}
      >
        <span class="icon-[si--close-circle-duotone]" style="width: 20px; height: 20px;"></span>
      </button>
    {/if}
  </div>
  
  {#if showPicker}
    <div class="absolute z-50 mt-2 shadow-lg rounded-lg">
      <emoji-picker></emoji-picker>
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
