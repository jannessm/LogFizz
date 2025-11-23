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
