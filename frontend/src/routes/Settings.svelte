<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import ProfileSection from '../components/settings/ProfileSection.svelte';
  import PasswordSection from '../components/settings/PasswordSection.svelte';
  import SyncStatusSection from '../components/settings/SyncStatusSection.svelte';
  import { authStore } from '../stores/auth';
  import { syncService } from '../services/sync';
  import { navigate } from '../lib/navigation';
  import { getSetting, saveSetting } from '../lib/db';
  import { snackbar } from '../stores/snackbar';
  // Import version from frontend package.json
  // Vite allows importing JSON files directly
  import pkg from '../../package.json';

  let name = $state('');
  let originalName = $state('');
  let hasPendingSync = $state(false);
  let editOnStopEnabled = $state(true);

  let user = $derived($authStore.user);
  let isOnline = $derived(typeof navigator !== 'undefined' ? navigator.onLine : true);

  onMount(async () => {
    if (user) {
      name = user.name;
      originalName = user.name;
    }
    hasPendingSync = await syncService.hasPendingSync();
    const setting = await getSetting('editOnStop');
    editOnStopEnabled = setting !== false; // default true
  });

  async function handleProfileUpdate(event: { name: string }) {
    const { name: updatedName } = event;
    
    try {
      const updatedUser = await authStore.updateProfile({ 
        name: updatedName
      });
      snackbar.success('Profile updated successfully');
      // Update local state with the server response
      name = updatedUser.name;
      originalName = updatedUser.name;
    } catch (error: any) {
      snackbar.error(error.message);
    }
  }

  async function handlePasswordChange(currentPassword: string, newPassword: string) {
    try {
      await authStore.changePassword(currentPassword, newPassword);
      snackbar.success('Password changed successfully');
    } catch (error: any) {
      snackbar.error(error.message);
    }
  }

  async function handleSync() {
    try {
      snackbar.info('Syncing...', 2000);
      await syncService.sync('all');
      hasPendingSync = await syncService.hasPendingSync();
      snackbar.success('Sync completed successfully');
    } catch (error: any) {
      snackbar.error(error.message || 'Sync failed. Please try again.');
    }
  }

  async function handleLogout() {
    await authStore.logout();
    navigate('/login');
  }

  function handleError(message: string) {
    snackbar.error(message);
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

      <ProfileSection
        email={user?.email || ''}
        bind:name
        {originalName}
        onsubmit={handleProfileUpdate}
        onerror={handleError}
      />

      <PasswordSection
        onsubmit={handlePasswordChange}
        onerror={handleError}
      />

      <SyncStatusSection
        {hasPendingSync}
        {isOnline}
        onsync={handleSync}
      />

      <!-- Timer Behavior -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Timer Behavior</h3>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={editOnStopEnabled}
            onchange={handleToggleEditOnStop}
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
          onclick={handleLogout}
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
