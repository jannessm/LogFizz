<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../stores/auth';
  import { snackbar } from '../stores/snackbar';
  import { navigate } from '../lib/navigation';
  import { _ } from '../lib/i18n';

  let isVerifying = $state(true);
  let errorMessage = $state('');

  onMount(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token') || '';

    if (!token) {
      snackbar.error($_('settings.invalidEmailChangeToken'));
      navigate('/settings');
      return;
    }

    try {
      await authStore.verifyEmailChange(token);
      snackbar.success($_('settings.emailChangeSuccess'));
      navigate('/settings', { replace: true });
    } catch (error: any) {
      isVerifying = false;
      if (error.response?.status === 429) {
        errorMessage = $_('auth.tooManyAttempts');
      } else {
        errorMessage = error.message || $_('settings.invalidEmailChangeToken');
      }
    }
  });
</script>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center" style="max-width: 500px;">
    {#if isVerifying}
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        {$_('settings.verifyingEmailChange')}
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        {$_('auth.pleaseWait')}
      </p>
    {:else}
      <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded">
        {errorMessage}
      </div>
      <button
        onclick={() => navigate('/settings')}
        class="mt-4 text-primary hover:underline"
      >
        {$_('common.backToSettings')}
      </button>
    {/if}
  </div>
</div>
