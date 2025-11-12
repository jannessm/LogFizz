<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import { authStore } from '../stores/auth';
  import { syncService } from '../services/sync';
  import { navigate } from '../lib/navigation';

  let name = '';
  let state = '';
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let hasPendingSync = false;
  let errorMessage = '';
  let successMessage = '';

  $: user = $authStore.user;

  onMount(async () => {
    if (user) {
      name = user.name;
      state = user.state || '';
    }
    hasPendingSync = await syncService.hasPendingSync();
  });

  async function handleProfileUpdate() {
    errorMessage = '';
    successMessage = '';
    
    try {
      await authStore.updateProfile(name, state || undefined);
      successMessage = 'Profile updated successfully';
    } catch (error: any) {
      errorMessage = error.message;
    }
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

<div class="min-h-screen bg-gray-50 pb-16">
  <div class="mx-auto px-4 py-6" style="max-width: 500px;">
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
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            bind:value={name}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label for="state" class="block text-sm font-medium text-gray-700 mb-1">
            State/Region (optional)
          </label>
          <input
            id="state"
            type="text"
            bind:value={state}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., California, Bavaria"
          />
        </div>

        <button
          on:click={handleProfileUpdate}
          class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
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
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
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
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Pending changes to sync
            </p>
          {:else}
            <p class="text-sm text-green-600 mt-1 flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              All synced
            </p>
          {/if}
        </div>
        <button
          on:click={handleSync}
          disabled={!navigator.onLine}
          class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
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
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Logout
      </button>
    </div>
  </div>

  <BottomNav currentTab="settings" />
</div>
