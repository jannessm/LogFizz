<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import AlertMessage from '../components/settings/AlertMessage.svelte';
  import ProfileSection from '../components/settings/ProfileSection.svelte';
  import PasswordSection from '../components/settings/PasswordSection.svelte';
  import SyncStatusSection from '../components/settings/SyncStatusSection.svelte';
  import { authStore } from '../stores/auth';
  import { syncService } from '../services/sync';
  import { navigate } from '../lib/navigation';
  import { getSetting, saveSetting } from '../lib/db';
  // Import version from frontend package.json
  // Vite allows importing JSON files directly
  import pkg from '../../package.json';

  let name = '';
  let originalName = '';
  let hasPendingSync = false;
  let errorMessage = '';
  let successMessage = '';
  let editOnStopEnabled = true;

  $: user = $authStore.user;
  $: isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  onMount(async () => {
    if (user) {
      name = user.name;
      originalName = user.name;
    }
    hasPendingSync = await syncService.hasPendingSync();
    const setting = await getSetting('editOnStop');
    editOnStopEnabled = setting !== false; // default true
  });

  async function handleProfileUpdate(event: CustomEvent) {
    errorMessage = '';
    successMessage = '';
    
    const { name: updatedName } = event.detail;
    
    try {
      const updatedUser = await authStore.updateProfile({ 
        name: updatedName
      });
      successMessage = 'Profile updated successfully';
      // Update local state with the server response
      name = updatedUser.name;
      originalName = updatedUser.name;
    } catch (error: any) {
      errorMessage = error.message;
    }
  }

  async function handlePasswordChange(event: CustomEvent) {
    errorMessage = '';
    successMessage = '';
    
    const { currentPassword, newPassword } = event.detail;

    try {
      await authStore.changePassword(currentPassword, newPassword);
      successMessage = 'Password changed successfully';
    } catch (error: any) {
      errorMessage = error.message;
    }
  }

  async function handleSync() {
    await syncService.syncAll();
    hasPendingSync = await syncService.hasPendingSync();
  }

  async function handleLogout() {
    await authStore.logout();
    navigate('/login');
  }

  function handleError(event: CustomEvent) {
    errorMessage = event.detail;
    successMessage = '';
  }

  async function handleToggleEditOnStop() {
    await saveSetting('editOnStop', editOnStopEnabled);
  }
</script>

<div class="h-screen bg-gray-50 flex flex-col">
  <!-- Full-width scrollable settings container -->
  <div class="w-full px-4 py-6 flex-1 overflow-auto">
    <!-- Inner centered container to preserve original max-width layout -->
    <div class="w-full max-w-lg mx-auto">
      <!-- Header -->
      <h1 class="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

      <AlertMessage type="error" message={errorMessage} />
      <AlertMessage type="success" message={successMessage} />

      <ProfileSection
        email={user?.email || ''}
        bind:name
        {originalName}
        on:submit={handleProfileUpdate}
        on:error={handleError}
      />

      <PasswordSection
        on:submit={handlePasswordChange}
        on:error={handleError}
      />

      <SyncStatusSection
        {hasPendingSync}
        {isOnline}
        on:sync={handleSync}
      />

      <!-- Subscription -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Subscription</h3>
        <button
          on:click={() => navigate('/payment')}
          class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <span>Manage Subscription</span>
        </button>
        <p class="text-sm text-gray-500 mt-2">
          View your subscription status and manage your billing.
        </p>
      </div>

      <!-- Timer Behavior -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Timer Behavior</h3>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={editOnStopEnabled}
            on:change={handleToggleEditOnStop}
            class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span class="text-gray-700">Open edit form when stopping timers</span>
        </label>
        <p class="text-sm text-gray-500 mt-2 ml-6">
          When enabled, stopping a timer will open the edit form so you can add notes immediately.
        </p>
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

      <!-- Footer with version and legal links -->
      <div class="mt-6 text-center text-sm text-gray-500">
        <div class="mb-2">Version {pkg.version}</div>
        <div class="flex justify-center gap-4">
          <!-- <a href="/impressum" class="hover:underline text-gray-600" target="_blank" rel="noopener noreferrer">Impressum</a>
          <a href="/datenschutz" class="hover:underline text-gray-600" target="_blank" rel="noopener noreferrer">Datenschutzbestimmung</a> -->
        </div>
      </div>
    </div>
  </div>

  <BottomNav currentTab="settings" />
</div>
