<script lang="ts">
  import { onMount } from 'svelte';
  import type { TargetWithSpecs, Timer, TargetSpec } from '../../types';
  import { targetsStore } from '../../stores/targets';
  import { statesStore } from '../../stores/states';
  import { timersStore } from '../../stores/timers';
  import TargetSpecItem from './TargetSpecItem.svelte';
  import { dayjs } from '../../types';

  let {
    target = null,
    close,
  }: {
    target?: TargetWithSpecs | null;
    close: () => void;
  } = $props();

  let name = $state('');
  
  // Manage multiple target specs with their start dates
  type SpecWithDate = {
    spec: TargetSpec | null;
    startDate: string;
  };
  let targetSpecs: SpecWithDate[] = $state([]);
  
  let isLoading = $state(false);
  let errorMessage = $state('');
  let availableTimers = $state<Timer[]>([]);
  let selectedTimerIds = $state<string[]>([]);
  let initialized = $state(false);
  let showAllSpecs = $state(false);
  let archiveDate = $state<string | null>(null);
  let isArchived = $derived(
    archiveDate !== null && archiveDate !== ''
  );
  
  // Get all targets for displaying which target a timer is assigned to
  let allTargets = $derived($targetsStore.items || []);

  // Effect for initializing form data from target prop
  $effect(() => {
    // Only run when target prop changes
    const targetId = target?.id;
    
    name = target?.name || '';
    
    if (target?.target_specs?.length) {
      // Sort specs by start date descending (newest first)
      const sortedSpecs = [...target.target_specs].sort((a, b) => 
        dayjs(b.starting_from).valueOf() - dayjs(a.starting_from).valueOf()
      );
      
      targetSpecs = sortedSpecs.map(spec => ({
        spec: spec,
        startDate: dayjs(spec.starting_from).format('YYYY-MM-DD')
      }));
    } else {
      targetSpecs = [{
        spec: null,
        startDate: dayjs().format('YYYY-MM-DD')
      }];
    }
    
    // Set archive date from the first (newest) spec's ending_at if it exists
    if (target?.target_specs?.length) {
      const newestSpec = [...target.target_specs].sort((a, b) => 
        dayjs(b.starting_from).valueOf() - dayjs(a.starting_from).valueOf()
      )[0]; // Newest spec (at index 0 after descending sort)
      
      if (newestSpec?.ending_at) {
        archiveDate = dayjs(newestSpec.ending_at).format('YYYY-MM-DD');
      } else {
        archiveDate = null;
      }
    } else {
      archiveDate = null;
    }
    
    initialized = false;
  });

  // Separate effect for timers to avoid circular dependencies
  $effect(() => {
    if ($timersStore.items) {
      availableTimers = $timersStore.items;
      
      // Only pre-select on initial load
      if (target?.id && !initialized) {
        selectedTimerIds = availableTimers
          .filter(b => b.target_id === target.id)
          .map(b => b.id);
        initialized = true;
      }
    }
  });

  function addSpec() {
    targetSpecs = [{
      spec: null,
      startDate: dayjs().format('YYYY-MM-DD')
    }, ...targetSpecs];
    showAllSpecs = true;
  }

  function saveSpecHandler(spec: any, index: number) {
    // Create a proper TargetSpec from the partial spec
    const fullSpec: TargetSpec = {
      id: spec.id,
      user_id: spec.user_id || target?.user_id || '',
      target_id: spec.target_id || target?.id || '',
      duration_minutes: spec.duration_minutes,
      exclude_holidays: spec.exclude_holidays,
      state_code: spec.state_code,
      starting_from: targetSpecs[index].startDate,
      ending_at: undefined, // Will be calculated in handleSubmit
    };
    
    // Update the spec at the given index
    targetSpecs[index].spec = fullSpec;
    
    // Trigger reactivity
    targetSpecs = [...targetSpecs];
  }

  function deleteSpecHandler(index: number) {
    if (targetSpecs.filter(s => s.spec !== null).length <= 1) {
      errorMessage = 'Cannot delete the last specification. A target must have at least one.';
      return;
    }
    
    if (confirm('Delete this schedule?')) {
      targetSpecs = targetSpecs.filter((_, i) => i !== index);
      errorMessage = '';
    }
  }

  function handleStartDateChange(index: number, newDate: string) {
    targetSpecs[index].startDate = newDate;
    targetSpecs = [...targetSpecs];
  } 

  onMount(async () => {
    await statesStore.load();
  });

  function toggleTimer(timerId: string) {
    if (selectedTimerIds.includes(timerId)) {
      selectedTimerIds = selectedTimerIds.filter(id => id !== timerId);
    } else {
      selectedTimerIds = [...selectedTimerIds, timerId];
    }
  }

  async function updateTimerAssignments(targetId: string) {
    // Get timers that were previously assigned to this target
    const previouslyAssigned = availableTimers
      .filter(t => t.target_id === (target?.id || null))
      .map(t => t.id);

    // Find timers to assign (newly selected)
    const toAssign = selectedTimerIds.filter(id => !previouslyAssigned.includes(id));

    // Find timers to unassign (previously selected but now deselected)
    const toUnassign = previouslyAssigned.filter(id => !selectedTimerIds.includes(id));

    // Update timers
    for (const timerId of toAssign) {
      await timersStore.update(timerId, { target_id: targetId });
    }

    for (const timerId of toUnassign) {
      await timersStore.update(timerId, { target_id: undefined });
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      errorMessage = 'Please enter a target name';
      return;
    }

    // Filter out null specs (placeholders)
    const validSpecs = targetSpecs
      .filter((s): s is SpecWithDate & { spec: TargetSpec } => s.spec !== null)
      .map((s, index, arr) => {
        const spec = s.spec;
        const startDate = dayjs(s.startDate);
        
        // Calculate end date based on position and archive date
        let endDate: dayjs.Dayjs | undefined = undefined;
        
        if (index === 0 && archiveDate) {
          // This is the newest (current) spec, use archive date if provided
          endDate = dayjs(archiveDate);
        } else if (index === 0 && !archiveDate) {
          // No archive date, so no end date for current spec
          endDate = undefined;
        } else if (index < arr.length - 1) {
          // There's a next (older) spec, use its start date - 1 day
          const nextStartDate = dayjs(arr[index + 1].startDate);
          endDate = nextStartDate.subtract(1, 'day');
        }
        // If this is the oldest spec and no archive date, no end date
        
        // Create a plain object to avoid proxy cloning issues
        return {
          id: spec.id,
          user_id: spec.user_id,
          target_id: spec.target_id,
          duration_minutes: [...spec.duration_minutes], // Clone array
          exclude_holidays: spec.exclude_holidays,
          state_code: spec.state_code,
          starting_from: startDate.toISOString(),
          ending_at: endDate?.toISOString(),
        };
      });

    if (validSpecs.length === 0) {
      errorMessage = 'Please add at least one target specification';
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      const targetData: Partial<TargetWithSpecs> = {
        name: name.trim(),
        target_specs: validSpecs.map(spec => ({
          ...spec,
          user_id: target?.user_id || '',
          target_id: target?.id || '',
        })),
      };

      let savedTargetId: string;

      if (target) {
        await targetsStore.update(target.id, targetData);
        savedTargetId = target.id;
      } else {
        const newTarget = await targetsStore.create(targetData);
        savedTargetId = newTarget.id;
      }

      // Update timer assignments
      await updateTimerAssignments(savedTargetId);

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
      <h2 class="text-xl font-semibold text-gray-800">{target ? 'Edit' : 'Add'} Target</h2>
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
                Define work schedules for different time periods. Most recent first.
              </p>
            </div>
            <button
              type="button"
              onclick={() => addSpec()}
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
            <div class="space-y-0">
              {#each targetSpecs as specWithDate, index (specWithDate.spec?.id || `null-${index}`)}
                {@const isVisible = index === 0 || (index === 1 && !showAllSpecs) || showAllSpecs}
                {@const isFaded = index === 1 && !showAllSpecs}
                
                {#if isVisible}
                  <div 
                    class="relative overflow-hidden transition-all duration-300"
                    style={isFaded ? 'max-height: 80px;' : ''}
                  >
                    <!-- Gradient fade overlay for second item -->
                    {#if isFaded}
                      <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white pointer-events-none z-20" style="background: linear-gradient(to bottom, transparent 0%, transparent 40%, white 100%);"></div>
                    {/if}
                    
                    <!-- Timeline connector (except for last item) -->
                    {#if index < targetSpecs.length - 1 && (showAllSpecs || index === 0)}
                      <div class="absolute left-[70px] top-[80px] w-0.5 bg-blue-300 z-0" style="height: calc(100% - 80px);"></div>
                    {/if}
                    
                    <div class="flex gap-2 items-start py-2 relative z-10">
                      <!-- Date Input -->
                      <div class="flex-shrink-0 relative" style="width: 140px;">
                        <label class="block text-xs font-medium text-gray-700 mb-1" for="start-date-{index}">
                          {#if index === 0 && !archiveDate}
                            <span class="text-blue-600 font-semibold">● Current</span>
                          {:else}
                            Start Date
                          {/if}
                        </label>
                        <input
                          id="start-date-{index}"
                          type="date"
                          bind:value={specWithDate.startDate}
                          onchange={() => handleStartDateChange(index, specWithDate.startDate)}
                          class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {#if index < targetSpecs.length - 1}
                          <p class="text-xs text-gray-500 mt-1">
                            Ends: {dayjs(targetSpecs[index + 1].startDate).subtract(1, 'day').format('MMM D, YYYY')}
                          </p>
                        {:else if index === 0 && archiveDate}
                          <p class="text-xs text-gray-500 mt-1">
                            Ends: {dayjs(archiveDate).format('MMM D, YYYY')}
                          </p>
                        {:else}
                          <p class="text-xs text-gray-500 mt-1">No end date</p>
                        {/if}
                      </div>
                      
                      <!-- Target Spec Component -->
                      <div class="flex-1">
                        <TargetSpecItem
                          targetSpec={specWithDate.spec}
                          lastSpec={targetSpecs.filter(s => s.spec !== null).length <= 1}
                          saveSpec={(spec) => saveSpecHandler(spec, index)}
                          deleteSpec={() => deleteSpecHandler(index)}
                        />
                      </div>
                    </div>
                  </div>
                {/if}
              {/each}
              
              <!-- Show More/Less Button -->
              {#if targetSpecs.length > 1}
                <div class="flex justify-center pt-2 pb-1">
                  <button
                    type="button"
                    onclick={() => showAllSpecs = !showAllSpecs}
                    class="px-3 py-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1"
                  >
                    {#if showAllSpecs}
                      <span class="icon-[si--chevron-up-line] w-4 h-4"></span>
                      Show Less ({targetSpecs.length - 1} hidden)
                    {:else}
                      <span class="icon-[si--chevron-down-line] w-4 h-4"></span>
                      Show All ({targetSpecs.length - 1} more)
                    {/if}
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Archive Target Section -->
        <div class="border-t pt-4">
          <p class="text-xs text-gray-500 mb-2">
            Set an end date to archive this target. The current target ends on this date.
          </p>
          <div class="flex items-start gap-3">
            <div class="flex-1">
              <input
                id="archive-date"
                type="date"
                bind:value={archiveDate}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave empty to keep target active"
              />
              {#if archiveDate}
                <p class="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  This target ends on {dayjs(archiveDate).format('MMM D, YYYY')}
                </p>
              {/if}
            </div>
            {#if archiveDate}
              <button
                type="button"
                onclick={() => archiveDate = null}
                class="px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex items-center gap-1"
                title="Remove archive date"
              >
                <span class="icon-[si--close-line] w-4 h-4"></span>
                Clear
              </button>
            {/if}
          </div>
        </div>

        <!-- Button Assignment -->
        {#if target}
          <div class="border-t pt-4 mt-4">
            <div class="block text-sm font-medium text-gray-700 mb-3">
              Assign Timers
            </div>
            <p class="text-xs text-gray-500 mb-3">
              Select timers to track time towards this target. Selecting a timer that's already assigned to another target will reassign it to this target.
            </p>
            
            {#if availableTimers.length === 0}
              <p class="text-sm text-gray-500 italic">No timers available. Create timers first to assign them to this target.</p>
            {:else}
              <div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {#each availableTimers as timer}
                  {@const assignedTarget = timer.target_id ? allTargets.find(t => t.id === timer.target_id) : null}
                  <button
                    type="button"
                    onclick={() => toggleTimer(timer.id)}
                    class="flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 relative group"
                    class:border-blue-500={selectedTimerIds.includes(timer.id)}
                    class:bg-blue-50={selectedTimerIds.includes(timer.id)}
                    class:shadow-md={selectedTimerIds.includes(timer.id)}
                    class:border-gray-200={!selectedTimerIds.includes(timer.id)}
                    class:hover:border-gray-300={!selectedTimerIds.includes(timer.id)}
                    class:hover:bg-gray-50={!selectedTimerIds.includes(timer.id)}
                  >
                    {#if selectedTimerIds.includes(timer.id)}
                      <div class="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <span class="icon-[si--check-line] text-white w-3 h-3"></span>
                      </div>
                    {/if}
                    
                    <div class="flex items-center justify-center mb-2">
                      {#if timer.emoji}
                        <span class="text-2xl">{timer.emoji}</span>
                      {/if}
                    </div>

                    <span class="text-sm font-medium text-gray-800 text-center line-clamp-2">{timer.name}</span>

                    {#if assignedTarget && assignedTarget.id !== target?.id}
                      <span class="text-[10px] text-orange-600 mt-1 text-center" title="Currently assigned to {assignedTarget.name}">assigned to: {assignedTarget.name}</span>
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

<style>
  /* Add backdrop blur effect */
  div[role="button"] {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
