<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DailyTarget } from '../types';
  import { targetsStore } from '../stores/targets';

  export let target: DailyTarget | null = null;

  const dispatch = createEventDispatcher();

  let name = target?.name || '';
  // Get first duration value if target exists, otherwise default to 90 minutes (1h 30m)
  const firstDuration = target?.duration_minutes?.[0] || 90;
  let durationHours = Math.floor(firstDuration / 60);
  let durationMinutes = firstDuration % 60;
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
      // Create array with same duration for each selected weekday
      // Backend expects an array, one entry per weekday that has this target
      const duration_minutes = weekdays.map(() => totalMinutes);
      
      const targetData = {
        name: name.trim(),
        duration_minutes,
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
  class="fixed inset-0 z-50 flex items-center justify-center p-4" 
  on:click={handleClose}
  on:keydown={(e) => e.key === 'Escape' && handleClose()}
  role="button"
  tabindex="0"
>
  <div 
    class="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
    on:click|stopPropagation
    on:keydown|stopPropagation
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
      <h2 class="text-xl font-semibold text-gray-800">{target ? 'Edit' : 'Add'} Daily Target</h2>
      <button
        on:click={handleClose}
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
          <div class="block text-sm font-medium text-gray-700 mb-2">
            Daily Duration *
          </div>
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

<style>
  /* Add backdrop blur effect */
  div[role="button"] {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
