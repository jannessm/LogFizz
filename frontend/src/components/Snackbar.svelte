<script lang="ts">
  import { snackbar } from '../stores/snackbar';
  import { fly, fade } from 'svelte/transition';
  
  $: messages = $snackbar.messages;

  function getColorClasses(type: string): string {
    switch (type) {
      case 'success':
        return 'bg-green-600 text-white';
      case 'error':
        return 'bg-red-600 text-white';
      case 'warning':
        return 'bg-yellow-500 text-black';
      case 'info':
      default:
        return 'bg-blue-600 text-white';
    }
  }

  function getIcon(type: string): string {
    switch (type) {
      case 'success':
        return 'icon-[si--check-line]';
      case 'error':
        return 'icon-[si--close-circle-line]';
      case 'warning':
        return 'icon-[si--alert-duotone]';
      case 'info':
      default:
        return 'icon-[si--information-line]';
    }
  }
</script>

<!-- Snackbar container -->
<div class="fixed bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
  {#each messages as message (message.id)}
    <div
      transition:fly={{ y: 50, duration: 300 }}
      class="max-w-md w-full {getColorClasses(message.type)} rounded-lg shadow-lg p-4 flex items-center gap-3 pointer-events-auto"
    >
      <!-- Icon -->
      <span class="w-6 h-6 {getIcon(message.type)} flex-shrink-0"></span>
      
      <!-- Message -->
      <div class="flex-1 text-sm font-medium">
        {message.message}
      </div>
      
      <!-- Action button -->
      {#if message.action}
        <button
          on:click={() => {
            message.action?.callback();
            snackbar.dismiss(message.id);
          }}
          class="px-3 py-1 text-sm font-semibold rounded hover:bg-white/20 transition-colors uppercase"
        >
          {message.action.label}
        </button>
      {/if}
      
      <!-- Close button -->
      <button
        on:click={() => snackbar.dismiss(message.id)}
        class="w-5 h-5 icon-[si--close-line] flex-shrink-0 hover:bg-white/20 rounded transition-colors"
        aria-label="Close"
      ></button>
    </div>
  {/each}
</div>
