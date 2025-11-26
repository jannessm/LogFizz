<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import type { DailyTarget, State, Button } from '../types';
  import { targetsStore } from '../stores/targets';
  import { statesStore } from '../stores/states';
  import { buttonsStore } from '../stores/buttons';

  export let target: DailyTarget | null = null;

  const dispatch = createEventDispatcher();

  let name = target?.name || '';
  // Get first duration value if target exists, otherwise default to 90 minutes (1h 30m)
  const firstDuration = target?.duration_minutes?.[0] || 90;
  let durationHours = Math.floor(firstDuration / 60);
  let durationMinutes = firstDuration % 60;
  let weekdays = target?.weekdays || [1, 2, 3, 4, 5]; // Mon-Fri by default
  let excludeHolidays = target?.exclude_holidays || false;
  let stateId = target?.state_id || '';
  let startingFrom = target?.starting_from ? target.starting_from.split('T')[0] : '';
  let isLoading = false;
  let errorMessage = '';
  let availableStates: State[] = [];
  let selectedCountry = '';
  let filteredStates: State[] = [];
  let availableCountries: string[] = [];
  let availableButtons: Button[] = [];
  let selectedButtonIds: string[] = [];

  $: if ($buttonsStore.buttons) {
    availableButtons = $buttonsStore.buttons;
    
    // If editing a target, pre-select buttons that are already assigned to this target
    if (target?.id && availableButtons.length > 0 && selectedButtonIds.length === 0) {
      selectedButtonIds = availableButtons
        .filter(b => b.target_id === target.id)
        .map(b => b.id);
    }
  }

  $: if ($statesStore.states) {
    availableStates = $statesStore.states;
    
    // Extract unique countries from states
    const countries = new Set(availableStates.map(s => s.country));
    availableCountries = Array.from(countries).sort();
    
    // If we have a target with state_id, find and set the country
    if (target?.state_id && availableStates.length > 0 && !selectedCountry) {
      const targetState = availableStates.find(s => s.id === target.state_id);
      if (targetState) {
        selectedCountry = targetState.country;
      }
    }
  }

  $: {
    if (selectedCountry) {
      filteredStates = availableStates.filter(s => s.country === selectedCountry)
        .sort((a, b) => a.state.localeCompare(b.state));
    } else {
      filteredStates = [];
    }
  }

  function handleCountryChange() {
    // Reset state selection when country changes
    stateId = '';
  }

  onMount(async () => {
    await statesStore.load();
  });

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

  function toggleButton(buttonId: string) {
    if (selectedButtonIds.includes(buttonId)) {
      selectedButtonIds = selectedButtonIds.filter(id => id !== buttonId);
    } else {
      selectedButtonIds = [...selectedButtonIds, buttonId];
    }
  }

  async function updateButtonAssignments(targetId: string) {
    // Get buttons that were previously assigned to this target
    const previouslyAssigned = availableButtons
      .filter(b => b.target_id === (target?.id || null))
      .map(b => b.id);

    // Find buttons to assign (newly selected)
    const toAssign = selectedButtonIds.filter(id => !previouslyAssigned.includes(id));

    // Find buttons to unassign (previously selected but now deselected)
    const toUnassign = previouslyAssigned.filter(id => !selectedButtonIds.includes(id));

    // Update buttons
    for (const buttonId of toAssign) {
      await buttonsStore.update(buttonId, { target_id: targetId });
    }

    for (const buttonId of toUnassign) {
      await buttonsStore.update(buttonId, { target_id: undefined });
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
      
      const targetData: Partial<DailyTarget> = {
        name: name.trim(),
        duration_minutes,
        weekdays,
        exclude_holidays: excludeHolidays,
        state_id: stateId || undefined,
        starting_from: startingFrom ? new Date(startingFrom).toISOString() : undefined,
      };

      let savedTargetId: string;

      if (target) {
        await targetsStore.update(target.id, targetData);
        savedTargetId = target.id;
      } else {
        const newTarget = await targetsStore.create(targetData);
        savedTargetId = newTarget.id;
      }

      // Update button assignments
      await updateButtonAssignments(savedTargetId);

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

        <!-- Exclude Holidays Toggle -->
        <div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={excludeHolidays}
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="text-sm text-gray-700">
              Exclude public holidays from balance calculation
            </span>
          </label>
          <p class="text-xs text-gray-500 mt-1 ml-6">
            When enabled, public holidays won't count as missed target days in the monthly balance
          </p>
        </div>

        <!-- Button Assignment -->
        {#if target}
          <div class="border-t pt-4 mt-4">
            <div class="block text-sm font-medium text-gray-700 mb-3">
              Assign Buttons (Optional)
            </div>
            <p class="text-xs text-gray-500 mb-3">
              Select buttons to track time towards this daily target
            </p>
            
            {#if availableButtons.length === 0}
              <p class="text-sm text-gray-500 italic">No buttons available. Create buttons first to assign them to this target.</p>
            {:else}
              <div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {#each availableButtons as button}
                  <button
                    type="button"
                    on:click={() => toggleButton(button.id)}
                    class="flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 relative group"
                    class:border-blue-500={selectedButtonIds.includes(button.id)}
                    class:bg-blue-50={selectedButtonIds.includes(button.id)}
                    class:shadow-md={selectedButtonIds.includes(button.id)}
                    class:border-gray-200={!selectedButtonIds.includes(button.id)}
                    class:hover:border-gray-300={!selectedButtonIds.includes(button.id)}
                    class:hover:bg-gray-50={!selectedButtonIds.includes(button.id)}
                  >
                    {#if selectedButtonIds.includes(button.id)}
                      <div class="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <span class="icon-[si--check-line] text-white w-3 h-3"></span>
                      </div>
                    {/if}
                    
                    <div class="flex items-center justify-center mb-2">
                      {#if button.emoji}
                        <span class="text-2xl">{button.emoji}</span>
                      {:else if button.icon}
                        <span class="w-8 h-8 {button.icon}" style="color: {button.color || '#000'}"></span>
                      {:else}
                        <span class="w-8 h-8 icon-[si--button-duotone]" style="color: {button.color || '#6B7280'}"></span>
                      {/if}
                    </div>
                    
                    <span class="text-sm font-medium text-gray-800 text-center line-clamp-2">{button.name}</span>
                    
                    {#if button.target_id && button.target_id !== target?.id}
                      <span class="text-[10px] text-orange-600 mt-1 text-center">assigned elsewhere</span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Holiday Settings -->
        <div class="border-t pt-4 mt-4">
          <div class="block text-sm font-medium text-gray-700 mb-3">
            Holiday Settings (Optional)
          </div>
          <p class="text-xs text-gray-500 mb-3">
            Select your location to exclude public holidays from this target's calculation
          </p>

          <div class="space-y-3">
            <!-- Country -->
            <div>
              <label for="country" class="block text-sm text-gray-600 mb-1">
                Country
              </label>
              <select
                id="country"
                bind:value={selectedCountry}
                on:change={handleCountryChange}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">-- Select a country --</option>
                {#each availableCountries as country}
                  <option value={country}>{country}</option>
                {/each}
              </select>
            </div>

            <!-- State -->
            {#if selectedCountry}
              <div>
                <label for="state" class="block text-sm text-gray-600 mb-1">
                  State/Region
                </label>
                <select
                  id="state"
                  bind:value={stateId}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">-- Select a state --</option>
                  {#each filteredStates as s}
                    <option value={s.id}>{s.state} ({s.code})</option>
                  {/each}
                </select>
              </div>
            {/if}

            <!-- Starting From -->
            <div>
              <label for="startingFrom" class="block text-sm text-gray-600 mb-1">
                Tracking Starts From
              </label>
              <input
                id="startingFrom"
                type="date"
                bind:value={startingFrom}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p class="text-xs text-gray-500 mt-1">
                Optional: Date from which tracking starts (important for balance computations)
              </p>
            </div>
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
