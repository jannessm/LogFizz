<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import ProfileSection from '../components/settings/ProfileSection.svelte';
  import PasswordSection from '../components/settings/PasswordSection.svelte';
  import SyncStatusSection from '../components/settings/SyncStatusSection.svelte';
  import { authStore } from '../stores/auth';
  import { themeStore, type ThemeMode } from '../stores/theme';
  import { syncService } from '../services/sync';
  import { navigate } from '../lib/navigation';
  import { getSetting, saveSetting } from '../lib/db';
  import { snackbar } from '../stores/snackbar';
  import { balancesStore } from '../stores/balances';
  // Import version from frontend package.json
  // Vite allows importing JSON files directly
  import pkg from '../../package.json';

  let name = $state('');
  let originalName = $state('');
  let hasPendingSync = $state(false);
  let editOnStopEnabled = $state(true);
  let isRecalculating = $state(false);
  let themeMode: ThemeMode = $state('auto');
  let firstDayOfWeek: 'sunday' | 'monday' = $state('sunday');

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
    
    // Load theme setting
    themeMode = $themeStore.mode;
    
    // Load first day of week setting
    const firstDaySetting = await getSetting('firstDayOfWeek');
    firstDayOfWeek = firstDaySetting || 'sunday'; // default sunday
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
      let syncingSnackbarId: string | null = null;
      const showSyncingTimeout = setTimeout(() => {
        syncingSnackbarId = snackbar.info('Syncing...', 2000);
      }, 1000);

      await syncService.sync('all');
      hasPendingSync = await syncService.hasPendingSync();
      
      clearTimeout(showSyncingTimeout);
      if (syncingSnackbarId) {
        snackbar.dismiss(syncingSnackbarId);
      }
      
      snackbar.success('Sync completed successfully');
    } catch (error: any) {
      snackbar.error(error.message || 'Sync failed. Please try again.');
    }
  }

  async function handleRecalculateBalances() {
    if (isRecalculating) return;
    
    try {
      isRecalculating = true;
      snackbar.info('Recalculating all balances...', 3000);
      
      await balancesStore.recalculateBalances();
      
      snackbar.success('Balances recalculated successfully');
    } catch (error: any) {
      snackbar.error(error.message || 'Failed to recalculate balances');
    } finally {
      isRecalculating = false;
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

  async function handleThemeChange() {
    await themeStore.setMode(themeMode);
  }

  async function handleFirstDayChange() {
    await saveSetting('firstDayOfWeek', firstDayOfWeek);
  }
</script>

<div class="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
  <!-- Full-width scrollable settings container -->
  <div class="w-full px-4 py-6 flex-1 overflow-auto">
    <!-- Inner centered container to preserve original max-width layout -->
    <div class="w-full max-w-lg mx-auto">
      <!-- Header -->
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Settings</h1>

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

      <!-- Appearance -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Appearance</h3>
        
        <!-- Theme Setting -->
        <div class="mb-4">
          <label for="theme-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Theme
          </label>
          <select
            id="theme-select"
            bind:value={themeMode}
            onchange={handleThemeChange}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto (System)</option>
          </select>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Choose your preferred color scheme
          </p>
        </div>

        <!-- First Day of Week Setting -->
        <div>
          <label for="first-day-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            First Day of Week
          </label>
          <select
            id="first-day-select"
            bind:value={firstDayOfWeek}
            onchange={handleFirstDayChange}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="sunday">Sunday</option>
            <option value="monday">Monday</option>
          </select>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Sets the first day of the week in calendar views
          </p>
        </div>
      </div>

      <!-- Timer Behavior -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Timer Behavior</h3>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={editOnStopEnabled}
            onchange={handleToggleEditOnStop}
            class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span class="text-gray-700 dark:text-gray-300">Open edit form when stopping timers</span>
        </label>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 ml-6">
          When enabled, stopping a timer will open the edit form so you can add notes immediately.
        </p>
      </div>

      <!-- Maintenance -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Maintenance</h3>
        <button
          onclick={handleRecalculateBalances}
          disabled={isRecalculating}
          class="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-hover transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {#if isRecalculating}
            <span class="w-5 h-5 icon-[svg-spinners--3-dots-fade]"></span>
            Recalculating...
          {:else}
            Recalculate All Balances
          {/if}
        </button>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Recalculates all balance data from timelogs. This will mark existing balances as deleted and create new ones.
        </p>
      </div>

      <!-- Logout -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <button
          onclick={handleLogout}
          class="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
        >
          <span class="w-5 h-5 icon-[si--sign-out-line]"></span>
          Sign Out
        </button>
      </div>

      <!-- Footer with version and legal links -->
      <div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
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
