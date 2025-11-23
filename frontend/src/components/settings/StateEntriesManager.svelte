<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { State, StateEntry } from '../../types';

  export let stateEntries: StateEntry[] = [];
  export let availableStates: State[] = [];
  export let originalStateEntries: StateEntry[] = [];

  const dispatch = createEventDispatcher();

  let isAddingState = false;
  let editingStateEntryId: string | null = null;
  let selectedStateId = '';
  let registeredAt = '';

  $: sortedStateEntries = [...stateEntries].sort((a, b) => 
    new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime()
  );

  function hasUnsavedChanges(entry: StateEntry): boolean {
    const original = originalStateEntries.find(o => o.id === entry.id);
    if (!original) return true; // New entry
    return original.state_id !== entry.state_id || 
           original.registered_at !== entry.registered_at;
  }

  function startAddingState() {
    isAddingState = true;
    editingStateEntryId = null;
    selectedStateId = '';
    registeredAt = new Date().toISOString().split('T')[0];
  }

  function startEditingState(entry: StateEntry) {
    isAddingState = false;
    editingStateEntryId = entry.id;
    selectedStateId = entry.state_id;
    registeredAt = entry.registered_at.split('T')[0];
  }

  function cancelStateEdit() {
    isAddingState = false;
    editingStateEntryId = null;
    selectedStateId = '';
    registeredAt = '';
  }

  function saveStateEntry() {
    if (!selectedStateId || !registeredAt) {
      dispatch('error', 'Please select a state and enter a date');
      return;
    }

    const isoDate = new Date(registeredAt).toISOString();
    const selectedState = availableStates.find(s => s.id === selectedStateId);
    
    if (editingStateEntryId) {
      // Update existing entry
      stateEntries = stateEntries.map(entry => 
        entry.id === editingStateEntryId
          ? { ...entry, state_id: selectedStateId, registered_at: isoDate, state: selectedState }
          : entry
      );
    } else {
      // Add new entry
      const newEntry: StateEntry = {
        id: crypto.randomUUID(), // Temporary ID, will be replaced by backend
        state_id: selectedStateId,
        registered_at: isoDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        state: selectedState
      };
      stateEntries = [...stateEntries, newEntry];
    }

    dispatch('change', stateEntries);
    cancelStateEdit();
  }

  function deleteStateEntry(entryId: string) {
    if (confirm('Are you sure you want to delete this state entry?')) {
      stateEntries = stateEntries.filter(entry => entry.id !== entryId);
      dispatch('change', stateEntries);
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
</script>

<div>
  <div class="flex items-center justify-between mb-2">
    <div class="block text-sm font-medium text-gray-700">
      State/Region History
    </div>
    {#if !isAddingState && !editingStateEntryId}
      <button
        on:click={startAddingState}
        class="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
      >
        <span class="w-4 h-4 icon-[si--add-line]"></span>
        Add State
      </button>
    {/if}
  </div>

  <!-- Add/Edit State Form -->
  {#if isAddingState || editingStateEntryId}
    <div class="mb-3 p-3 border border-gray-300 rounded-md bg-gray-50">
      <div class="space-y-3">
        <div>
          <label for="stateSelect" class="block text-sm font-medium text-gray-700 mb-1">
            State
          </label>
          <select
            id="stateSelect"
            bind:value={selectedStateId}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a state...</option>
            {#each availableStates as state}
              <option value={state.id}>{state.state} ({state.code})</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="registeredDate" class="block text-sm font-medium text-gray-700 mb-1">
            Since
          </label>
          <input
            id="registeredDate"
            type="date"
            bind:value={registeredAt}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="flex gap-2">
          <button
            on:click={saveStateEntry}
            class="flex-1 bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-1 text-sm"
          >
            <span class="w-4 h-4 icon-[si--check-line]"></span>
            Save
          </button>
          <button
            on:click={cancelStateEdit}
            class="flex-1 bg-gray-500 text-white py-2 px-3 rounded-md hover:bg-gray-600 transition-colors flex items-center justify-center gap-1 text-sm"
          >
            <span class="w-4 h-4 icon-[si--close-line]"></span>
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- State Entries List -->
  <div class="space-y-2">
    {#if sortedStateEntries.length === 0}
      <p class="text-sm text-gray-500 italic">No state entries yet. Add your first state to include public holidays in your time tracking.</p>
    {:else}
      {#each sortedStateEntries as entry (entry.id)}
        <div class="flex items-center justify-between p-3 border rounded-md transition-colors {hasUnsavedChanges(entry) ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'}">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <div class="font-medium text-gray-900">
                {entry.state?.state || 'Unknown State'}
              </div>
              {#if hasUnsavedChanges(entry)}
                <span class="text-xs px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full font-medium">
                  Unsaved
                </span>
              {/if}
            </div>
            <div class="text-sm text-gray-600">
              Since: {formatDate(entry.registered_at)}
            </div>
          </div>
          <div class="flex gap-2">
            <button
              on:click={() => startEditingState(entry)}
              class="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors icon-[si--edit-detailed-duotone]"
              title="Edit"
            ></button>
            <button
              on:click={() => deleteStateEntry(entry.id)}
              class="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors icon-[si--bin-line]"
              title="Delete"
            ></button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
