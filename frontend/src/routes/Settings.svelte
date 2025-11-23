<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import { authStore } from '../stores/auth';
  import { syncService } from '../services/sync';
  import { navigate } from '../lib/navigation';
  import { statesApi } from '../services/api';
  import type { State, StateEntry } from '../types';

  let name = '';
  let originalName = '';
  let stateEntries: StateEntry[] = [];
  let originalStateEntries: StateEntry[] = []; // Track original state for comparison
  let availableStates: State[] = [];
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let hasPendingSync = false;
  let errorMessage = '';
  let successMessage = '';
  
  // For adding/editing state entries
  let isAddingState = false;
  let editingStateEntryId: string | null = null;
  let selectedStateId = '';
  let registeredAt = '';

  $: user = $authStore.user;
  $: sortedStateEntries = [...stateEntries].sort((a, b) => 
    new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime()
  );
  $: hasNameChanged = name !== originalName;
  
  // Check if a state entry has unsaved changes
  function hasUnsavedChanges(entry: StateEntry): boolean {
    const original = originalStateEntries.find(o => o.id === entry.id);
    if (!original) return true; // New entry
    return original.state_id !== entry.state_id || 
           original.registered_at !== entry.registered_at;
  }

  onMount(async () => {
    if (user) {
      name = user.name;
      originalName = user.name;
      stateEntries = user.state_entries || [];
      // Deep copy to track original state
      originalStateEntries = JSON.parse(JSON.stringify(stateEntries));
    }
    hasPendingSync = await syncService.hasPendingSync();
    
    // Fetch available states
    try {
      availableStates = await statesApi.getAllStates();
    } catch (error) {
      console.error('Failed to load states:', error);
    }
  });

  async function handleProfileUpdate() {
    errorMessage = '';
    successMessage = '';
    
    try {
      await authStore.updateProfile({ 
        name,
        state_entries: stateEntries.map(entry => ({
          id: entry.id,
          state_id: entry.state_id,
          registered_at: entry.registered_at
        }))
      });
      successMessage = 'Profile updated successfully';
      // Update original state after successful save
      originalName = name;
      originalStateEntries = JSON.parse(JSON.stringify(stateEntries));
    } catch (error: any) {
      errorMessage = error.message;
    }
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
      errorMessage = 'Please select a state and enter a date';
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

    cancelStateEdit();
  }

  function deleteStateEntry(entryId: string) {
    if (confirm('Are you sure you want to delete this state entry?')) {
      stateEntries = stateEntries.filter(entry => entry.id !== entryId);
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  async function handlePasswordChange() {
    errorMessage = '';
    successMessage = '';

    if (newPassword !== confirmPassword) {
      errorMessage = 'New passwords do not match';
      return;
    }

    if (newPassword.length < 8) {
      errorMessage = 'Password must be at least 8 characters';
      return;
    }

    try {
      await authStore.changePassword(currentPassword, newPassword);
      successMessage = 'Password changed successfully';
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    } catch (error: any) {
      errorMessage = error.message;
    }
  }

  async function handleLogout() {
    await authStore.logout();
    navigate('/login');
  }

  async function handleSync() {
    await syncService.syncAll();
    hasPendingSync = await syncService.hasPendingSync();
  }
</script>

<div class="h-screen bg-gray-50 flex flex-col">
  <div class="mx-auto px-4 py-6 overflow-x-auto grow-1 w-full max-w-lg">
    <!-- Header -->
    <h1 class="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

    {#if errorMessage}
      <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
        {errorMessage}
      </div>
    {/if}

    {#if successMessage}
      <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
        {successMessage}
      </div>
    {/if}

    <!-- Profile Section -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Profile</h2>
      
      <div class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={user?.email}
            disabled
            class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
          />
        </div>

        <div>
          <div class="flex items-center gap-2 mb-1">
            <label for="name" class="block text-sm font-medium text-gray-700">
              Name
            </label>
            {#if hasNameChanged}
              <span class="text-xs px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full font-medium">
                Unsaved
              </span>
            {/if}
          </div>
          <input
            id="name"
            type="text"
            bind:value={name}
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors {hasNameChanged ? 'border-orange-400 bg-orange-50 focus:ring-orange-500' : 'border-gray-300 focus:ring-blue-500'}"
          />
        </div>

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

        <button
          on:click={handleProfileUpdate}
          class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <span class="w-5 h-5 icon-[si--check-line]"></span>
          Update Profile
        </button>
      </div>
    </div>

    <!-- Password Section -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Change Password</h2>
      
      <div class="space-y-4">
        <div>
          <label for="currentPassword" class="block text-sm font-medium text-gray-700 mb-1">
            Current Password
          </label>
          <input
            id="currentPassword"
            type="password"
            bind:value={currentPassword}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label for="newPassword" class="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            bind:value={newPassword}
            minlength="8"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            bind:value={confirmPassword}
            minlength="8"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          on:click={handlePasswordChange}
          class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <span class="w-5 h-5 icon-[si--key-line]"></span>
          Change Password
        </button>
      </div>
    </div>

    <!-- Sync Status -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Sync Status</h2>
      
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm flex items-center gap-2">
            {#if navigator.onLine}
              <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
              </svg>
              <span class="text-gray-600">Online</span>
            {:else}
              <svg class="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
              </svg>
              <span class="text-gray-600">Offline</span>
            {/if}
          </p>
          {#if hasPendingSync}
            <p class="text-sm text-yellow-600 mt-1 flex items-center gap-1">
              <span class="icon-[si--alert-duotone]" style="width: 24px; height: 24px;"></span>
              Pending changes to sync
            </p>
          {:else}
            <p class="text-sm text-green-600 mt-1 flex items-center gap-1">
              <span class="icon-[si--check-line]" style="width: 24px; height: 24px;"></span>
              All synced
            </p>
          {/if}
        </div>
        <button
          on:click={handleSync}
          disabled={!navigator.onLine}
          class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
        >
          <span class="w-5 h-5 icon-[si--cloud-line]"></span>
          Sync Now
        </button>
      </div>
    </div>

    <!-- Logout -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <button
        on:click={handleLogout}
        class="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
      >
        <span class="w-5 h-5 icon-[si--sign-out-line]"></span>
        Sign Out
      </button>
    </div>
  </div>

  <BottomNav currentTab="settings" />
</div>
