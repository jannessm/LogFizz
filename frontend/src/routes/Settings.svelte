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

  let name = '';
  let originalName = '';
  let hasPendingSync = false;
  let errorMessage = '';
  let successMessage = '';

  $: user = $authStore.user;
  $: isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  onMount(async () => {
    if (user) {
      name = user.name;
      originalName = user.name;
    }
    hasPendingSync = await syncService.hasPendingSync();
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
</script>

<div class="h-screen bg-gray-50 flex flex-col">
  <div class="mx-auto px-4 py-6 overflow-x-auto grow-1 w-full max-w-lg">
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
