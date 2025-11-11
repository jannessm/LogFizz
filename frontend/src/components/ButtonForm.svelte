<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Button } from '../types';
  import { buttonsStore } from '../stores/buttons';

  export let button: Button | null = null;

  const dispatch = createEventDispatcher();

  let name = button?.name || '';
  let emoji = button?.emoji || '';
  let color = button?.color || '#3B82F6';
  let goalTimeMinutes = button?.goal_time_minutes || 0;
  let goalDays = button?.goal_days || [1, 2, 3, 4, 5]; // Mon-Fri by default
  let autoSubtractBreaks = button?.auto_subtract_breaks ?? false;
  let isLoading = false;
  let errorMessage = '';

  const weekDays = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  const colorPresets = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
  ];

  function toggleDay(day: number) {
    if (goalDays.includes(day)) {
      goalDays = goalDays.filter(d => d !== day);
    } else {
      goalDays = [...goalDays, day].sort();
    }
  }

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
        goal_days: goalDays.length > 0 ? goalDays : undefined,
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

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" on:click={handleClose}>
  <div class="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto" on:click|stopPropagation>
    <div class="p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold text-gray-800">
          {button ? 'Edit' : 'Create'} Button
        </h2>
        <button
          on:click={handleClose}
          class="text-gray-400 hover:text-gray-600 text-2xl"
        >
          ×
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
          <label class="block text-sm font-medium text-gray-700 mb-2">
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
              ></button>
            {/each}
          </div>
          <input
            type="color"
            bind:value={color}
            class="w-full h-10 rounded-md border border-gray-300"
          />
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
        </div>

        <!-- Goal Days -->
        {#if goalTimeMinutes > 0}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Goal applies to:
            </label>
            <div class="flex gap-2 flex-wrap">
              {#each weekDays as day}
                <button
                  type="button"
                  on:click={() => toggleDay(day.value)}
                  class="px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  class:bg-blue-600={goalDays.includes(day.value)}
                  class:text-white={goalDays.includes(day.value)}
                  class:bg-gray-200={!goalDays.includes(day.value)}
                  class:text-gray-700={!goalDays.includes(day.value)}
                >
                  {day.label}
                </button>
              {/each}
            </div>
          </div>

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
