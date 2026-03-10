<script lang="ts">
  import { _ } from '../../lib/i18n';

  let {
    onsubmit,
    onerror,
    isOnline = true,
  }: {
    onsubmit: (currentPassword: string, newPassword: string) => Promise<void>;
    onerror?: (message: string) => void;
    isOnline?: boolean;
  } = $props();

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');

  async function handlePasswordChange() {
    if (newPassword !== confirmPassword) {
      onerror?.($_('settings.passwordMismatch'));
      return;
    }

    if (newPassword.length < 8) {
      onerror?.($_('auth.passwordMinLength'));
      return;
    }

    await onsubmit(currentPassword, newPassword);
    
    // Clear fields after submission (parent will handle success/error)
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
  <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">{$_('settings.changePassword')}</h2>
  
  {#if !isOnline}
    <p class="text-sm text-yellow-600 dark:text-yellow-400 mb-4 flex items-center gap-1">
      <span class="icon-[si--alert-duotone]" style="width: 20px; height: 20px;"></span>
      {$_('common.offlineUnavailable')}
    </p>
  {/if}

  <div class="space-y-4">
    <div>
      <label for="currentPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {$_('settings.currentPassword')}
      </label>
      <input
        id="currentPassword"
        type="password"
        bind:value={currentPassword}
        disabled={!isOnline}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
      />
    </div>

    <div>
      <label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {$_('settings.newPassword')}
      </label>
      <input
        id="newPassword"
        type="password"
        bind:value={newPassword}
        minlength="8"
        disabled={!isOnline}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
      />
    </div>

    <div>
      <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {$_('settings.confirmPassword')}
      </label>
      <input
        id="confirmPassword"
        type="password"
        bind:value={confirmPassword}
        minlength="8"
        disabled={!isOnline}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
      />
    </div>

    <button
      onclick={handlePasswordChange}
      disabled={!isOnline}
      class="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span class="w-5 h-5 icon-[si--key-line]"></span>
      {$_('settings.changePassword')}
    </button>
  </div>
</div>
