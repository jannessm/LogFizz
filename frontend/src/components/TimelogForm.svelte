<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import dayjs from 'dayjs';
  import { buttonsStore } from '../stores/buttons';

  export let selectedDate: dayjs.Dayjs;
  export let existingLog: any = null;

  const dispatch = createEventDispatcher();

  let buttonId = existingLog?.button_id || '';
  let startDate = existingLog?.startTime ? dayjs(existingLog.startTime).format('YYYY-MM-DD') : selectedDate.format('YYYY-MM-DD');
  let startTime = existingLog?.startTime ? dayjs(existingLog.startTime).format('HH:mm') : '';
  let endDate = existingLog?.endTime ? dayjs(existingLog.endTime).format('YYYY-MM-DD') : selectedDate.format('YYYY-MM-DD');
  let endTime = existingLog?.endTime ? dayjs(existingLog.endTime).format('HH:mm') : '';
  let isSingleEntry = !existingLog?.endTime;

  $: buttons = $buttonsStore.buttons;

  function handleSubmit() {
    if (!buttonId || !startDate || !startTime) {
      alert('Please fill all required fields');
      return;
    }

    const startTimestamp = `${startDate}T${startTime}:00`;
    let endTimestamp = null;

    if (!isSingleEntry) {
      if (!endDate || !endTime) {
        alert('Please provide end date and time for paired entry');
        return;
      }
      endTimestamp = `${endDate}T${endTime}:00`;

      // Validate end is after start
      if (new Date(endTimestamp) <= new Date(startTimestamp)) {
        alert('End time must be after start time');
        return;
      }
    }

    dispatch('save', {
      button_id: buttonId,
      startTimestamp,
      endTimestamp,
      existingLog
    });
  }

  function handleClose() {
    dispatch('close');
  }
</script>

<div 
  class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  role="button"
  tabindex="-1"
  aria-label="Close modal"
  on:click={handleClose}
  on:keydown={(e) => e.key === 'Escape' && handleClose()}
>
  <div 
    class="bg-white rounded-lg shadow-xl w-full max-w-[500px] mx-4 p-6"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    on:click|stopPropagation
    on:keydown={() => {}}
  >
    <h2 class="text-2xl font-bold text-gray-800 mb-6">
      {existingLog ? 'Edit' : 'Add'} Time Entry
    </h2>

    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <!-- Button Selection -->
      <div>
        <label for="button" class="block text-sm font-medium text-gray-700 mb-1">
          Button *
        </label>
        <select
          id="button"
          bind:value={buttonId}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        >
          <option value="">Select a button</option>
          {#each buttons as button}
            <option value={button.id}>
              {button.emoji ? button.emoji + ' ' : ''}{button.name}
            </option>
          {/each}
        </select>
      </div>

      <!-- Entry Type -->
      <div>
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            bind:checked={isSingleEntry}
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span class="text-sm font-medium text-gray-700">Single entry (no end time)</span>
        </label>
      </div>

      <!-- Start Date and Time -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">
            Start Date *
          </label>
          <input
            id="startDate"
            type="date"
            bind:value={startDate}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label for="startTime" class="block text-sm font-medium text-gray-700 mb-1">
            Start Time *
          </label>
          <input
            id="startTime"
            type="time"
            bind:value={startTime}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
      </div>

      <!-- End Date and Time -->
      {#if !isSingleEntry}
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="endDate" class="block text-sm font-medium text-gray-700 mb-1">
              End Date *
            </label>
            <input
              id="endDate"
              type="date"
              bind:value={endDate}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label for="endTime" class="block text-sm font-medium text-gray-700 mb-1">
              End Time *
            </label>
            <input
              id="endTime"
              type="time"
              bind:value={endTime}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>
      {/if}

      <!-- Actions -->
      <div class="flex gap-3 pt-4">
        <button
          type="button"
          on:click={handleClose}
          class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {existingLog ? 'Update' : 'Add'} Entry
        </button>
      </div>
    </form>
  </div>
</div>
