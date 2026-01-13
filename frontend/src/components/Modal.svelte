<script lang="ts">
  import { type Snippet } from 'svelte';

  let {
    title = '',
    maxWidth = 'max-w-lg',
    maxHeight = 'max-h-[90vh]',
    showHeader = true,
    showCloseButton = true,
    zIndex = 'z-50',
    onclose,
    children,
    header,
    footer
  }: {
    title?: string;
    maxWidth?: string;
    maxHeight?: string;
    showHeader?: boolean;
    showCloseButton?: boolean;
    zIndex?: string;
    onclose?: () => void;
    children?: Snippet;
    header?: Snippet;
    footer?: Snippet;
  } = $props();

  function handleClose() {
    if (onclose) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleClose();
  }
</script>

<!-- Modal Overlay -->
<div 
  class="fixed inset-0 {zIndex} flex items-center justify-center p-4"
  onclick={handleClose}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
>
  <!-- Modal Content -->
  <div 
    class="bg-white rounded-lg shadow-2xl w-full {maxWidth} {maxHeight} overflow-hidden flex flex-col"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Header -->
    {#if showHeader}
      <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        {#if header}
          {@render header()}
        {:else}
          <h2 class="text-xl font-semibold text-gray-800">{title}</h2>
        {/if}
        {#if showCloseButton}
          <button
            onclick={handleClose}
            class="text-gray-400 hover:text-gray-600 transition-colors icon-[si--close-circle-duotone]"
            style="width: 28px; height: 28px;"
            aria-label="Close"
          ></button>
        {/if}
      </div>
    {/if}

    <!-- Content -->
    <div class="overflow-y-auto flex-1 p-6">
      {#if children}
        {@render children()}
      {/if}
    </div>

    <!-- Footer -->
    {#if footer}
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Add backdrop blur effect */
  div[role="button"] {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
