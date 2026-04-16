<script lang="ts">
  import { authStore } from '../stores/auth';
  import { navigate } from '../lib/navigation';
  import HCaptcha from '../components/HCaptcha.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { _ } from '../lib/i18n';
  import { get } from 'svelte/store';

  let email = '';
  let name = '';
  let isRegisterMode = false;
  let errorMessage = '';
  let successMessage = '';
  let isLoading = false;
  let hcaptchaToken = '';
  let hcaptchaComponent: { reset: () => void } | undefined = undefined;
  let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY || '';

  function updateOnlineStatus() {
    if (typeof navigator !== 'undefined') {
      isOnline = navigator.onLine;
    }
  }

  onMount(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    }
  });

  function handleHCaptchaVerify(token: string) {
    hcaptchaToken = token;
  }

  function handleHCaptchaError(error: string) {
    errorMessage = $_('auth.hCaptchaFailed');
    console.error('hCaptcha error:', error);
  }

  function handleHCaptchaExpire() {
    hcaptchaToken = '';
    errorMessage = $_('auth.hCaptchaExpired');
  }

  async function handleSubmit() {
    errorMessage = '';
    successMessage = '';

    if (isRegisterMode) {
      // Registration requires hCaptcha
      if (!hcaptchaToken && HCAPTCHA_SITE_KEY) {
        errorMessage = $_('auth.completeHCaptcha');
        return;
      }
    }

    isLoading = true;

    try {
      if (isRegisterMode) {
        await authStore.register(email, name, hcaptchaToken);
        // After registration, show success message (user must check email for magic link)
        successMessage = $_('auth.registrationSuccess');
      } else {
        // Login: request magic link
        await authStore.requestMagicLink(email);
        successMessage = $_('auth.magicLinkSent');
      }
    } catch (error: any) {
      // Check for rate limiting (429 Too Many Requests)
      if (error.response?.status === 429) {
        errorMessage = $_('auth.tooManyAttempts');
      } else {
        errorMessage = error.message || $_('auth.authFailed');
      }
      // Reset hCaptcha on error
      if (isRegisterMode && hcaptchaComponent?.reset) {
        hcaptchaComponent.reset();
      }
      hcaptchaToken = '';
    } finally {
      isLoading = false;
    }
  }

  function toggleMode() {
    isRegisterMode = !isRegisterMode;
    errorMessage = '';
    successMessage = '';
    hcaptchaToken = '';
    // Reset hCaptcha when switching modes
    if (hcaptchaComponent?.reset) {
      hcaptchaComponent.reset();
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8" style="max-width: 500px;">
    <h1 class="text-3xl font-bold text-center text-gray-800 dark:text-gray-100 mb-6">
      {isRegisterMode ? $_('auth.registerToTapShift') : $_('auth.loginToTapShift')}
    </h1>

    {#if errorMessage}
      <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded">
        {errorMessage}
      </div>
    {/if}

    {#if successMessage}
      <!-- Intermediate "check your email" page (login and register) -->
      <div class="text-center space-y-4">
        <div class="flex justify-center">
          <svg class="w-16 h-16 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p class="text-gray-700 dark:text-gray-300 text-base">
          {successMessage}
        </p>
        <button
          on:click={() => { successMessage = ''; email = ''; isRegisterMode = false; }}
          class="text-primary hover:underline text-sm"
        >
          {$_('auth.backToLogin')}
        </button>
      </div>
    {:else}
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        {#if isRegisterMode}
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {$_('auth.name')}
            </label>
            <input
              id="name"
              type="text"
              bind:value={name}
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={$_('auth.name')}
            />
          </div>
        {/if}

        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {$_('auth.email')}
          </label>
          <input
            id="email"
            type="email"
            bind:value={email}
            required
            pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]&#123;2,&#125;"
            title={$_('validation.validEmailRequired')}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="your@email.com"
          />
        </div>

        {#if isRegisterMode && HCAPTCHA_SITE_KEY}
          <HCaptcha 
            bind:this={hcaptchaComponent}
            sitekey={HCAPTCHA_SITE_KEY}
            onVerify={handleHCaptchaVerify}
            onError={handleHCaptchaError}
            onExpire={handleHCaptchaExpire}
          />
        {/if}

        <button
          type="submit"
          disabled={isLoading || !isOnline || (isRegisterMode && !hcaptchaToken && !!HCAPTCHA_SITE_KEY)}
          class="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-hover disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          {#if !isOnline}
            {$_('common.offline')}
          {:else}
            {isLoading ? $_('auth.pleaseWait') : isRegisterMode ? $_('auth.register') : $_('auth.login')}
          {/if}
        </button>
      </form>

      <div class="mt-6 text-center">
        <button
          on:click={toggleMode}
          disabled={!isOnline}
          class="text-primary hover:underline text-sm disabled:text-gray-400 disabled:cursor-not-allowed disabled:no-underline"
        >
          {isRegisterMode 
            ? $_('auth.hasAccount')
            : $_('auth.noAccount')}
        </button>
      </div>
    {/if}
  </div>
</div>
