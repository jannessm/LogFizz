<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../stores/auth';
  import { snackbar } from '../stores/snackbar';
  import { navigate } from '../lib/navigation';
  import { _ } from '../lib/i18n';
  import { get } from 'svelte/store';

  type State = 'verifying' | 'already-logged-in' | 'error';

  let state = $state<State>('verifying');
  let errorMessage = $state('');
  // Preserve the token so the user can sign out and the page can continue
  let token = $state('');

  onMount(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('token') || '';

    if (!token) {
      snackbar.error($_('auth.invalidMagicLinkToken'));
      navigate('/login');
      return;
    }

    // If the user is already authenticated, don't silently overwrite their session
    if (get(authStore).isAuthenticated) {
      state = 'already-logged-in';
      return;
    }

    await verify();
  });

  async function verify() {
    state = 'verifying';
    try {
      await authStore.verifyMagicLink(token);
      snackbar.success($_('auth.magicLinkVerified'));

      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (error: any) {
      errorMessage = error.response?.status === 429
        ? $_('auth.tooManyAttempts')
        : error.message || $_('auth.invalidMagicLinkToken');
      state = 'error';
    }
  }

  async function signOutAndContinue() {
    await authStore.logout();
    await verify();
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center" style="max-width: 500px;">

    {#if state === 'verifying'}
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        {$_('auth.verifyingMagicLink')}
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        {$_('auth.pleaseWait')}
      </p>

    {:else if state === 'already-logged-in'}
      <div class="flex justify-center mb-4">
        <svg class="w-14 h-14 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3">
        {$_('auth.alreadyLoggedIn')}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        {$_('auth.alreadyLoggedInHint')}
      </p>
      <div class="flex flex-col gap-3">
        <button
          onclick={signOutAndContinue}
          class="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-hover transition-colors"
        >
          {$_('auth.signOutAndContinue')}
        </button>
        <button
          onclick={() => navigate('/')}
          class="text-primary hover:underline text-sm"
        >
          {$_('auth.backToLogin')}
        </button>
      </div>

    {:else}
      <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded">
        {errorMessage}
      </div>
      <button
        onclick={() => navigate('/login')}
        class="mt-4 text-primary hover:underline"
      >
        {$_('auth.backToLogin')}
      </button>
    {/if}

  </div>
</div>
