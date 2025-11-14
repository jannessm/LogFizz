<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Button } from '../types';
  import { buttonsStore } from '../stores/buttons';
  import { targetsStore } from '../stores/targets';

  export let button: Button | null = null;

  const dispatch = createEventDispatcher();

  let name = button?.name || '';
  let emoji = button?.emoji || '';
  let color = button?.color || '#3B82F6';
  let goalTimeMinutes = button?.goal_time_minutes || 0;
  let targetId = button?.target_id || '';
  let autoSubtractBreaks = button?.auto_subtract_breaks ?? false;
  let isLoading = false;
  let errorMessage = '';

  const colorPresets = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
  ];

  async function handleSubmit() {
    if (!name.trim()) {
      errorMessage = 'Please enter a button name';
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      const buttonData = {
        name: name.trim(),
        emoji: emoji || undefined,
        color,
        goal_time_minutes: goalTimeMinutes > 0 ? goalTimeMinutes : undefined,
        target_id: targetId || undefined,
        auto_subtract_breaks: autoSubtractBreaks,
        position: button?.position || 0,
      };

      if (button) {
        await buttonsStore.update(button.id, buttonData);
      } else {
        await buttonsStore.create(buttonData);
      }

      dispatch('close');
    } catch (error: any) {
      errorMessage = error.message || 'Failed to save button';
    } finally {
      isLoading = false;
    }
  }

  function handleClose() {
    dispatch('close');
  }
</script>

<div 
  class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
  on:click={handleClose}
  on:keydown={(e) => e.key === 'Escape' && handleClose()}
  role="button"
  tabindex="-1"
  aria-label="Close modal"
>
  <div 
    class="bg-white rounded-lg w-full max-h-[90vh] overflow-y-auto"
    style="max-width: 500px;" 
    on:click|stopPropagation
    on:keydown|stopPropagation
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold text-gray-800">
          {button ? 'Edit' : 'Create'} Button
        </h2>
        <button
          on:click={handleClose}
          class="text-gray-400 hover:text-gray-600 icon-[si--close-duotone]"
          aria-label="Close"
        >
        </button>
      </div>

      {#if errorMessage}
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {errorMessage}
        </div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
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

        <!-- Emoji -->
        <div>
          <label for="emoji" class="block text-sm font-medium text-gray-700 mb-1">
            Emoji (optional)
          </label>
          <input
            id="emoji"
            type="text"
            bind:value={emoji}
            maxlength="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="📝"
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
                on:click={() => color = preset}
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

        <!-- Target Assignment -->
        <div>
          <label for="targetId" class="block text-sm font-medium text-gray-700 mb-1">
            Assign to Target (optional)
          </label>
          <select
            id="targetId"
            bind:value={targetId}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No target</option>
            {#each $targetsStore as target}
              <option value={target.id}>{target.name}</option>
            {/each}
          </select>
          <p class="text-xs text-gray-500 mt-1">
            Assign this button to a daily target to track progress
          </p>
        </div>

        <!-- Goal Time -->
        <div>
          <label for="goalTime" class="block text-sm font-medium text-gray-700 mb-1">
            Daily Goal (minutes)
          </label>
          <input
            id="goalTime"
            type="number"
            bind:value={goalTimeMinutes}
            min="0"
            step="15"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0 = no goal"
          />
          <p class="text-xs text-gray-500 mt-1">
            Optional: Set an individual goal for this button
          </p>
        </div>

        <!-- Auto subtract breaks -->
        {#if goalTimeMinutes > 0}
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
          {#if autoSubtractBreaks}
            <div class="text-xs text-gray-500 pl-6">
              <p>• 6-9 hours: 30 min break</p>
              <p>• 9+ hours: 45 min break</p>
            </div>
          {/if}
        {/if}

        <!-- Actions -->
        <div class="flex gap-3 pt-4">
          <button
            type="button"
            on:click={handleClose}
            class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : button ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
