<script lang="ts">
  import type { Timer } from '../../types';
  import { timersStore } from '../../stores/timers';
  import EmojiPicker from './EmojiPicker.svelte';

  let {
    timer = null,
    close
  }: {
    timer?: Timer | null;
    close: () => void;
  } = $props();

  let name = $derived(timer?.name || '');
  let emoji = $derived(timer?.emoji || '');
  let color = $derived(timer?.color || '#3B82F6');
  let autoSubtractBreaks = $derived(timer?.auto_subtract_breaks ?? false);
  let archived = $derived(timer?.archived ?? false);
  let isLoading = $state(false);
  let errorMessage = $state('');

  const colorPresets = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
  ];

  async function handleSubmit() {
    if (!name.trim()) {
      errorMessage = 'Please enter a timer name';
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      const timerData = {
        name: name.trim(),
        emoji: emoji || undefined,
        color,
        auto_subtract_breaks: autoSubtractBreaks,
        archived,
      };

      if (timer) {
        await timersStore.update(timer.id, timerData);
      } else {
        await timersStore.create(timerData);
      }

      close();
    } catch (error: any) {
      errorMessage = error.message || 'Failed to save timer';
    } finally {
      isLoading = false;
    }
  }
</script>

<div 
  class="fixed inset-0 z-50 flex items-center justify-center p-4" 
  onclick={close}
  onkeydown={(e) => e.key === 'Escape' && close()}
  role="button"
  tabindex="0"
>
  <div 
    class="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
      <h2 class="text-xl font-semibold text-gray-800">{timer ? 'Edit' : 'Add'} Timer</h2>
      <button
        onclick={close}
        class="text-gray-400 hover:text-gray-600 transition-colors icon-[si--close-circle-duotone]"
        style="width: 28px; height: 28px;"
        aria-label="Close"
      ></button>
    </div>

    <!-- Content -->
    <div class="overflow-y-auto flex-1 p-6">
      {#if errorMessage}
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {errorMessage}
        </div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">

        <!-- Emoji -->
        <div>
          <EmojiPicker value={emoji} />
        </div>

        <!-- Name -->
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
            Button Name *
          </label>
          <input
            id="name"
            type="text"
            bind:value={name}
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Work, Exercise"
          />
        </div>

        <!-- Color -->
        <div>
          <label for="colorPicker" class="block text-sm font-medium text-gray-700 mb-2">
            Color
          </label>
          <div class="flex gap-2 flex-wrap mb-2">
            {#each colorPresets as preset}
              <button
                type="button"
                onclick={() => color = preset}
                class="w-10 h-10 rounded-lg border-2 transition-all"
                class:border-gray-800={color === preset}
                class:border-gray-300={color !== preset}
                style="background-color: {preset}"
                aria-label="Select color {preset}"
              ></button>
            {/each}
          </div>
          <input
            id="colorPicker"
            type="color"
            bind:value={color}
            class="w-full h-10 rounded-md border border-gray-300"
          />
        </div>

        <!-- Goal Time -->
        <!-- Auto subtract breaks -->
        <div class="flex items-center">
          <input
            id="autoBreaks"
            type="checkbox"
            bind:checked={autoSubtractBreaks}
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label for="autoBreaks" class="ml-2 text-sm text-gray-700">
            Automatically subtract break time
          </label>
        </div>
        <div class="text-xs text-gray-500 pl-6">
          <p>• 6-9 hours: 30 min break</p>
          <p>• 9+ hours: 45 min break</p>
        </div>

        <!-- Archived -->
        <div class="flex items-center">
          <input
            id="archived"
            type="checkbox"
            bind:checked={archived}
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label for="archived" class="ml-2 text-sm text-gray-700">
            Archive this timer
          </label>
        </div>
        <div class="text-xs text-gray-500 pl-6">
          <p>Archived timers are hidden from the main view but can still be accessed in reports</p>
        </div>

        <!-- Actions -->
        <div class="flex gap-3 pt-4">
          <button
            type="button"
            onclick={close}
            class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : timer ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<style>
  /* Add backdrop blur effect */
  div[role="button"] {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
