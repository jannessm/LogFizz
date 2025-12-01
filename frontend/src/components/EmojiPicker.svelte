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
    if (containerRef && !containerRef.contains(event.target as Node)) {
      show = false;
    }
  }
  
  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    
    // Add event listener for emoji selection
    if (pickerRef) {
      pickerRef.addEventListener('emoji-click', handleEmojiClick as EventListener);
    }
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
