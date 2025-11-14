<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DailyTarget } from '../types';
  import { targetsStore } from '../stores/targets';

  export let target: DailyTarget | null = null;

  const dispatch = createEventDispatcher();

  let name = target?.name || '';
  let durationHours = target ? Math.floor(target.duration_minutes / 60) : 1;
  let durationMinutes = target ? target.duration_minutes % 60 : 30;
  let weekdays = target?.weekdays || [1, 2, 3, 4, 5]; // Mon-Fri by default
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

  function toggleDay(day: number) {
    if (weekdays.includes(day)) {
      weekdays = weekdays.filter(d => d !== day);
    } else {
      weekdays = [...weekdays, day].sort();
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      errorMessage = 'Please enter a target name';
      return;
    }

    if (weekdays.length === 0) {
      errorMessage = 'Please select at least one day';
      return;
    }

    const totalMinutes = durationHours * 60 + durationMinutes;
    if (totalMinutes <= 0) {
      errorMessage = 'Please set a duration greater than 0';
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      const targetData = {
        name: name.trim(),
        duration_minutes: totalMinutes,
        weekdays,
      };

      if (target) {
        await targetsStore.update(target.id, targetData);
      } else {
        await targetsStore.create(targetData);
      }

      dispatch('close');
    } catch (error: any) {
      errorMessage = error.message || 'Failed to save target';
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
          {target ? 'Edit' : 'Create'} Daily Target
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
            Target Name *
          </label>
          <input
            id="name"
            type="text"
            bind:value={name}
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Work, Exercise, Study"
          />
        </div>

        <!-- Duration -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Daily Duration *
          </label>
          <div class="flex gap-4">
            <div class="flex-1">
              <label for="hours" class="block text-xs text-gray-600 mb-1">Hours</label>
              <input
                id="hours"
                type="number"
                bind:value={durationHours}
                min="0"
                max="23"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div class="flex-1">
              <label for="minutes" class="block text-xs text-gray-600 mb-1">Minutes</label>
              <input
                id="minutes"
                type="number"
                bind:value={durationMinutes}
                min="0"
                max="59"
                step="15"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <p class="text-sm text-gray-500 mt-1">
            Total: {durationHours}h {durationMinutes}m
          </p>
        </div>

        <!-- Weekdays -->
        <div>
          <div id="weekdaysLabel" class="block text-sm font-medium text-gray-700 mb-2">
            Target applies to: *
          </div>
          <div class="flex gap-2 flex-wrap" role="group" aria-labelledby="weekdaysLabel">
            {#each weekDays as day}
              <button
                type="button"
                on:click={() => toggleDay(day.value)}
                class="px-3 py-2 rounded-md text-sm font-medium transition-colors"
                class:bg-blue-600={weekdays.includes(day.value)}
                class:text-white={weekdays.includes(day.value)}
                class:bg-gray-200={!weekdays.includes(day.value)}
                class:text-gray-700={!weekdays.includes(day.value)}
                aria-pressed={weekdays.includes(day.value)}
              >
                {day.label}
              </button>
            {/each}
          </div>
        </div>

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
            {isLoading ? 'Saving...' : target ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
