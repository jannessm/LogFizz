<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import 'emoji-picker-element';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  let pickerRef: HTMLElement | null = null;
  let containerRef: HTMLElement | null = null;
  
  function handleEmojiClick(event: CustomEvent) {
    const emoji = event.detail.unicode;
    dispatch('select', emoji);
    show = false;
  }
  
  function handleClickOutside(event: MouseEvent) {
    if (containerRef && event.target && !containerRef.contains(event.target as Node)) {
      show = false;
    }
  }
  
  // Use reactive statement to attach event listener when picker is shown
  $: if (show && pickerRef) {
    pickerRef.addEventListener('emoji-click', handleEmojiClick as EventListener);
  }
  
  // Clean up listener when picker is hidden
  $: if (!show && pickerRef) {
    pickerRef.removeEventListener('emoji-click', handleEmojiClick as EventListener);
  }
  
  onMount(() => {
    document.addEventListener('click', handleClickOutside);
  });
  
  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
    if (pickerRef) {
      pickerRef.removeEventListener('emoji-click', handleEmojiClick as EventListener);
    }
  });
</script>

{#if show}
  <div 
    bind:this={containerRef}
    class="absolute z-50 top-full left-0 mt-1 shadow-lg rounded-lg overflow-hidden"
    on:click|stopPropagation
    on:keydown|stopPropagation
    role="dialog"
    aria-label="Emoji picker"
    tabindex="-1"
  >
    <emoji-picker bind:this={pickerRef}></emoji-picker>
  </div>
{/if}

<style>
  emoji-picker {
    --num-columns: 8;
    --emoji-padding: 0.5rem;
  }
</style>
