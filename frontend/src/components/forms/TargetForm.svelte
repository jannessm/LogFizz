<script lang="ts">
  import { onMount } from 'svelte';
  import type { TargetWithSpecs, State, Timer, TargetSpec } from '../../types';
  import { targetsStore } from '../../stores/targets';
  import { statesStore } from '../../stores/states';
  import { timersStore } from '../../stores/timers';
  import dayjs from '../../../../lib/utils/dayjs';

  let {
    target = null,
    close,

  }: {
    target?: TargetWithSpecs | null;
    close: () => void;
  } = $props();

  let name = target?.name || '';
  
  // Manage multiple target specs
  let targetSpecs: TargetSpec[] = target?.target_specs?.length ? [...target.target_specs] : [];
  let editingSpecIndex: number | null = null;
  let showSpecForm = false;

  $effect(() => {
    if (!target && targetSpecs.length === 0 && !showSpecForm) {
      // Use setTimeout to avoid updating during render
      setTimeout(() => openSpecForm(null), 0);
    }

    if ($timersStore.items) {
      availableButtons = $timersStore.items;
      
      // If editing a target, pre-select buttons that are already assigned to this target
      if (target?.id && availableButtons.length > 0 && selectedButtonIds.length === 0) {
        selectedButtonIds = availableButtons
          .filter(b => b.target_id === target.id)
          .map(b => b.id);
      }
    }

    if ($statesStore.states) {
      availableStates = $statesStore.states;
      
      // Extract unique countries from states
      const countries = new Set(availableStates.map(s => s.country));
      availableCountries = Array.from(countries).sort();
    }

  
    if (specFormState.selectedCountry) {
      filteredStates = availableStates.filter(s => s.country === specFormState.selectedCountry)
        .sort((a, b) => a.state.localeCompare(b.state));
    } else {
      filteredStates = [];
    }
  });

  // Form state for current spec being edited/created
  let specFormState = createEmptySpecForm();
  
  let isLoading = false;
  let errorMessage = '';
  let availableStates: State[] = [];
  let filteredStates: State[] = [];
  let availableCountries: string[] = [];
  let availableButtons: Timer[] = [];
  let selectedButtonIds: string[] = [];
  
  function createEmptySpecForm() {
    return {
      durationHours: 1,
      durationMinutes: 30,
      weekdays: [1, 2, 3, 4, 5] as number[],
      excludeHolidays: false,
      stateCode: '',
      selectedCountry: '',
      startingFrom: undefined as string | undefined,
      endingAt: undefined as string | undefined,
    };
  }

  function handleCountryChange() {
    // Reset state selection when country changes
    specFormState.stateCode = '';
  }

  function openSpecForm(index: number | null = null) {
    editingSpecIndex = index;
    
    if (index !== null && targetSpecs[index]) {
      // Editing existing spec
      const spec = targetSpecs[index];
      const firstDuration = spec.duration_minutes?.[0] || 90;
      
      specFormState = {
        durationHours: Math.floor(firstDuration / 60),
        durationMinutes: firstDuration % 60,
        weekdays: [...spec.weekdays],
        excludeHolidays: spec.exclude_holidays || false,
        stateCode: spec.state_code || '',
        selectedCountry: '',
        startingFrom: spec.starting_from ? spec.starting_from.split('T')[0] : undefined,
        endingAt: spec.ending_at ? spec.ending_at.split('T')[0] : undefined,
      };
      
      // Find country for state code
      if (spec.state_code && availableStates.length > 0) {
        const targetState = availableStates.find(s => s.code === spec.state_code);
        if (targetState) {
          specFormState.selectedCountry = targetState.country;
        }
      }
    } else {
      // Creating new spec
      specFormState = createEmptySpecForm();
      
      // If there are existing specs, find the latest ending_at date and use it as starting_from
      if (targetSpecs.length > 0) {
        // Sort specs by starting_from to find the last one
        const sortedSpecs = [...targetSpecs].sort((a, b) => {
          const dateA = a.starting_from ? new Date(a.starting_from).getTime() : 0;
          const dateB = b.starting_from ? new Date(b.starting_from).getTime() : 0;
          return dateB - dateA;
        });
        
        const lastSpec = sortedSpecs[0];
        
        // If the last spec has an ending_at, use it as the new starting_from
        if (lastSpec.ending_at) {
          // Add one day to the ending date to start the next day
          const nextDay = dayjs(lastSpec.ending_at).add(1, 'day');
          specFormState.startingFrom = nextDay.format('YYYY-MM-DD');
        }
      }
    }
    
    showSpecForm = true;
  }

  function closeSpecForm() {
    showSpecForm = false;
    editingSpecIndex = null;
    specFormState = createEmptySpecForm();
  }

  function saveSpec() {
    const totalMinutes = specFormState.durationHours * 60 + specFormState.durationMinutes;
    
    if (totalMinutes <= 0) {
      errorMessage = 'Duration must be greater than 0';
      return;
    }
    
    if (specFormState.weekdays.length === 0) {
      errorMessage = 'Please select at least one day';
      return;
    }
    
    const newSpec: TargetSpec = {
      id: editingSpecIndex !== null && targetSpecs[editingSpecIndex]?.id 
        ? targetSpecs[editingSpecIndex].id 
        : crypto.randomUUID(),
      user_id: target?.user_id || '',
      target_id: target?.id || '',
      duration_minutes: specFormState.weekdays.map(() => totalMinutes),
      weekdays: specFormState.weekdays,
      exclude_holidays: specFormState.excludeHolidays,
      state_code: specFormState.stateCode || undefined,
      starting_from: specFormState.startingFrom 
        ? new Date(specFormState.startingFrom).toISOString() 
        : dayjs().toISOString(), // Default to now if not specified
      ending_at: specFormState.endingAt ? new Date(specFormState.endingAt).toISOString() : undefined,
    };
    
    if (editingSpecIndex !== null) {
      // Update existing spec
      targetSpecs[editingSpecIndex] = newSpec;
      targetSpecs = [...targetSpecs];
    } else {
      // Add new spec
      targetSpecs = [...targetSpecs, newSpec];
    }
    
    closeSpecForm();
    errorMessage = '';
  }

  function deleteSpec(index: number) {
    if (targetSpecs.length === 1) {
      errorMessage = 'Cannot delete the last target spec. A target must have at least one specification.';
      return;
    }
    
    if (confirm('Are you sure you want to delete this target specification?')) {
      targetSpecs = targetSpecs.filter((_, i) => i !== index);
      errorMessage = '';
    }
  }

  function formatSpecSummary(spec: TargetSpec): string {
    const duration = spec.duration_minutes[0];
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    const durationStr = `${hours}h ${minutes}m`;
    
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = spec.weekdays.map(d => weekdayNames[d]).join(', ');
    
    let dateRange = '';
    if (spec.starting_from && spec.ending_at) {
      dateRange = `${dayjs(spec.starting_from).format('MMM D, YYYY')} - ${dayjs(spec.ending_at).format('MMM D, YYYY')}`;
    } else if (spec.starting_from) {
      dateRange = `From ${dayjs(spec.starting_from).format('MMM D, YYYY')}`;
    } else if (spec.ending_at) {
      dateRange = `Until ${dayjs(spec.ending_at).format('MMM D, YYYY')}`;
    } else {
      dateRange = 'No date restrictions';
    }
    
    return `${durationStr} • ${days} • ${dateRange}`;
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
    if (specFormState.weekdays.includes(day)) {
      specFormState.weekdays = specFormState.weekdays.filter(d => d !== day);
    } else {
      specFormState.weekdays = [...specFormState.weekdays, day].sort();
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
      await timersStore.update(buttonId, { target_id: targetId });
    }

    for (const buttonId of toUnassign) {
      await timersStore.update(buttonId, { target_id: undefined });
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      errorMessage = 'Please enter a target name';
      return;
    }

    if (targetSpecs.length === 0) {
      errorMessage = 'Please add at least one target specification';
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      const targetData: Partial<TargetWithSpecs> = {
        name: name.trim(),
        target_specs: targetSpecs,
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

      close();
    } catch (error: any) {
      errorMessage = error.message || 'Failed to save target';
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
      <h2 class="text-xl font-semibold text-gray-800">{target ? 'Edit' : 'Add'} Daily Target</h2>
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

        <!-- Target Specifications -->
        <div class="border-t pt-4">
          <div class="flex justify-between items-center mb-3">
            <div>
              <h3 class="text-sm font-medium text-gray-700">Target Specifications *</h3>
              <p class="text-xs text-gray-500 mt-1">
                Define work schedules for different time periods
              </p>
            </div>
            <button
              type="button"
              onclick={() => openSpecForm(null)}
              class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <span class="icon-[si--add-line] w-4 h-4"></span>
              Add Schedule
            </button>
          </div>

          <!-- List of Target Specs -->
          {#if targetSpecs.length === 0}
            <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <p class="text-gray-500 text-sm">No schedules defined yet</p>
              <p class="text-gray-400 text-xs mt-1">Click "Add Schedule" to create one</p>
            </div>
          {:else}
            <div class="space-y-2">
              {#each targetSpecs as spec, index}
                <div class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div class="flex justify-between items-start gap-3">
                    <div class="flex-1">
                      <div class="text-sm text-gray-700 mb-1">
                        {formatSpecSummary(spec)}
                      </div>
                      {#if spec.exclude_holidays}
                        <div class="flex items-center gap-1 text-xs text-gray-500">
                          <span class="icon-[si--sun-set-duotone] w-3 h-3"></span>
                          Excludes public holidays
                          {#if spec.state_code}
                            ({spec.state_code})
                          {/if}
                        </div>
                      {/if}
                    </div>
                    <div class="flex gap-1">
                      <button
                        type="button"
                        onclick={() => openSpecForm(index)}
                        class="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <span class="icon-[si--edit-detailed-duotone] w-4 h-4"></span>
                      </button>
                      {#if targetSpecs.length > 1}
                        <button
                          type="button"
                          onclick={() => deleteSpec(index)}
                          class="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete schedule"
                        >
                          <span class="icon-[si--bin-duotone] w-4 h-4"></span>
                        </button>
                      {:else}
                        <button
                          type="button"
                          disabled
                          class="p-1.5 text-gray-400 cursor-not-allowed rounded opacity-50"
                          title="Cannot delete the only schedule - a target must have at least one"
                        >
                          <span class="icon-[si--bin-duotone] w-4 h-4"></span>
                        </button>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
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
                    onclick={() => toggleButton(button.id)}
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
            {isLoading ? 'Saving...' : target ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- Target Spec Form Modal -->
{#if showSpecForm}
  <div 
    class="fixed inset-0 z-[60] flex items-center justify-center p-4" 
    onclick={closeSpecForm}
    onkeydown={(e) => e.key === 'Escape' && closeSpecForm()}
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
        <h3 class="text-lg font-semibold text-gray-800">
          {editingSpecIndex !== null ? 'Edit' : 'Add'} Schedule
        </h3>
        <button
          onclick={closeSpecForm}
          class="text-gray-400 hover:text-gray-600 transition-colors icon-[si--close-circle-duotone]"
          style="width: 24px; height: 24px;"
          aria-label="Close"
        ></button>
      </div>

      <!-- Content -->
      <div class="overflow-y-auto flex-1 p-6 space-y-4">
        <!-- Duration -->
        <div>
          <div class="block text-sm font-medium text-gray-700 mb-2">
            Daily Duration *
          </div>
          <div class="flex gap-4">
            <div class="flex-1">
              <label for="spec-hours" class="block text-xs text-gray-600 mb-1">Hours</label>
              <input
                id="spec-hours"
                type="number"
                bind:value={specFormState.durationHours}
                min="0"
                max="23"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div class="flex-1">
              <label for="spec-minutes" class="block text-xs text-gray-600 mb-1">Minutes</label>
              <input
                id="spec-minutes"
                type="number"
                bind:value={specFormState.durationMinutes}
                min="0"
                max="59"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <p class="text-sm text-gray-500 mt-1">
            Total: {specFormState.durationHours}h {specFormState.durationMinutes}m
          </p>
        </div>

        <!-- Weekdays -->
        <div>
          <div id="specWeekdaysLabel" class="block text-sm font-medium text-gray-700 mb-2">
            Active Days *
          </div>
          <div class="flex gap-2 flex-wrap" role="group" aria-labelledby="specWeekdaysLabel">
            {#each weekDays as day}
              <button
                type="button"
                onclick={() => toggleDay(day.value)}
                class="px-3 py-2 rounded-md text-sm font-medium transition-colors"
                class:bg-blue-600={specFormState.weekdays.includes(day.value)}
                class:text-white={specFormState.weekdays.includes(day.value)}
                class:bg-gray-200={!specFormState.weekdays.includes(day.value)}
                class:text-gray-700={!specFormState.weekdays.includes(day.value)}
                aria-pressed={specFormState.weekdays.includes(day.value)}
              >
                {day.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Date Range -->
        <div class="border-t pt-4">
          <div class="block text-sm font-medium text-gray-700 mb-3">
            Date Range (Optional)
          </div>
          
          <!-- Starting From -->
          <div class="mb-3">
            <label for="spec-startingFrom" class="block text-sm text-gray-600 mb-1">
              Starting From
            </label>
            <div class="flex gap-2">
              <input
                id="spec-startingFrom"
                type="date"
                bind:value={specFormState.startingFrom}
                class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                class:text-gray-300={!specFormState.startingFrom}
              />
              {#if specFormState.startingFrom}
                <button
                  type="button"
                  onclick={() => specFormState.startingFrom = undefined}
                  class="px-3 py-2 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 hover:text-red-600 transition-colors"
                  title="Clear date"
                >
                  <span class="icon-[si--close-line] w-4 h-4"></span>
                </button>
              {/if}
            </div>
          </div>

          <!-- Ending At -->
          <div>
            <label for="spec-endingAt" class="block text-sm text-gray-600 mb-1">
              Ending At
            </label>
            <div class="flex gap-2">
              <input
                id="spec-endingAt"
                type="date"
                bind:value={specFormState.endingAt}
                class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                class:text-gray-300={!specFormState.endingAt}
              />
              {#if specFormState.endingAt}
                <button
                  type="button"
                  onclick={() => specFormState.endingAt = undefined}
                  class="px-3 py-2 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 hover:text-red-600 transition-colors"
                  title="Clear date"
                >
                  <span class="icon-[si--close-line] w-4 h-4"></span>
                </button>
              {/if}
            </div>
          </div>
        </div>

        <!-- Holiday Settings -->
        <div class="border-t pt-4">
          <div class="block text-sm font-medium text-gray-700 mb-3">
            Holiday Settings (Optional)
          </div>
          
          <!-- Exclude Holidays Toggle -->
          <label class="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              bind:checked={specFormState.excludeHolidays}
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="text-sm text-gray-700">
              Exclude public holidays
            </span>
          </label>

          {#if specFormState.excludeHolidays}
            <!-- Country -->
            <div class="mb-3">
              <label for="spec-country" class="block text-sm text-gray-600 mb-1">
                Country
              </label>
              <select
                id="spec-country"
                bind:value={specFormState.selectedCountry}
                onchange={handleCountryChange}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">-- Select a country --</option>
                {#each availableCountries as country}
                  <option value={country}>{country}</option>
                {/each}
              </select>
            </div>

            <!-- State -->
            {#if specFormState.selectedCountry}
              <div>
                <label for="spec-state" class="block text-sm text-gray-600 mb-1">
                  State/Region
                </label>
                <select
                  id="spec-state"
                  bind:value={specFormState.stateCode}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">-- Select a state --</option>
                  {#each filteredStates as s}
                    <option value={s.code}>{s.state} ({s.code})</option>
                  {/each}
                </select>
              </div>
            {/if}
          {/if}
        </div>

        <!-- Actions -->
        <div class="flex gap-3 pt-4">
          <button
            type="button"
            onclick={closeSpecForm}
            class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onclick={saveSpec}
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {editingSpecIndex !== null ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Add backdrop blur effect */
  div[role="button"] {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
