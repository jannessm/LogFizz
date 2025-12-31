<script lang="ts">
  import { onMount } from 'svelte';
  import type { TargetWithSpecs, Timer, TargetSpec } from '../../types';
  import { targetsStore } from '../../stores/targets';
  import { statesStore } from '../../stores/states';
  import { timersStore } from '../../stores/timers';
  import TargetSpecItem from './TargetSpecItem.svelte';

  let {
    target = null,
    close,
  }: {
    target?: TargetWithSpecs | null;
    close: () => void;
  } = $props();

  let name = target?.name || '';
  
  // Manage multiple target specs
  let targetSpecs: (TargetSpec | null)[] = $state([]);
  
  let isLoading = false;
  let errorMessage = '';
  let availableTimers: Timer[] = [];
  let selectedTimerIds: string[] = [];

  $effect(() => {
    targetSpecs = target?.target_specs?.length ? [...target.target_specs] : [null];

    if ($timersStore.items) {
      availableTimers = $timersStore.items;
      
      // If editing a target, pre-select timers that are already assigned to this target
      if (target?.id && availableTimers.length > 0 && selectedTimerIds.length === 0) {
        selectedTimerIds = availableTimers
          .filter(b => b.target_id === target.id)
          .map(b => b.id);
      }
    }
  });

  function addSpec() {
    targetSpecs = [...targetSpecs, null];
  }

  function saveSpecHandler(spec: TargetSpec) {
    // Find if this spec already exists (by id)
    const existingIndex = targetSpecs.findIndex(s => s?.id === spec.id);
    
    if (existingIndex !== -1) {
      // Update existing spec
      targetSpecs[existingIndex] = spec;
    } else {
      // Find the null placeholder and replace it, or add to the end
      const nullIndex = targetSpecs.findIndex(s => s === null);
      if (nullIndex !== -1) {
        targetSpecs[nullIndex] = spec;
      } else {
        targetSpecs = [...targetSpecs, spec];
      }
    }
    
    // Trigger reactivity
    targetSpecs = [...targetSpecs];
  }

  function deleteSpecHandler(spec: TargetSpec) {
    if (targetSpecs.filter(s => s !== null).length <= 1) {
      errorMessage = 'Cannot delete the last specification. A target must have at least one.';
      return;
    }
    
    if (confirm('Delete this schedule?')) {
      targetSpecs = targetSpecs.filter(s => s?.id !== spec.id);
      errorMessage = '';
    }
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
    const validSpecs = targetSpecs.filter((s): s is TargetSpec => s !== null);

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
          starting_from: new Date(spec.starting_from).toISOString(),
          ending_at: spec.ending_at ? new Date(spec.ending_at).toISOString() : undefined,
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
                Define work schedules for different time periods
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
            <div class="space-y-2">
              {#each targetSpecs as targetSpec, index (targetSpec?.id || `null-${index}`)}
                <TargetSpecItem
                  {targetSpec}
                  lastSpec={targetSpecs.filter(s => s !== null).length <= 1}
                  saveSpec={saveSpecHandler}
                  deleteSpec={deleteSpecHandler}
                />
              {/each}
            </div>
          {/if}
        </div>

        <!-- Button Assignment -->
        {#if target}
          <div class="border-t pt-4 mt-4">
            <div class="block text-sm font-medium text-gray-700 mb-3">
              Assign Timers (Optional)
            </div>
            <p class="text-xs text-gray-500 mb-3">
              Select timers to track time towards this target
            </p>
            
            {#if availableTimers.length === 0}
              <p class="text-sm text-gray-500 italic">No timers available. Create timers first to assign them to this target.</p>
            {:else}
              <div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {#each availableTimers as timer}
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

                    {#if timer.target_id && timer.target_id !== target?.id}
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

<style>
  /* Add backdrop blur effect */
  div[role="button"] {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
