<script lang="ts">
  import { authStore } from '../stores/auth';
  import { navigate } from '../lib/navigation';
  import HCaptcha from '../components/HCaptcha.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { _ } from '../lib/i18n';
  import { get } from 'svelte/store';

  let email = '';
  let password = '';
  let name = '';
  let isRegisterMode = false;
  let errorMessage = '';
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
    errorMessage = get(_)('auth.hCaptchaFailed');
    console.error('hCaptcha error:', error);
  }

  function handleHCaptchaExpire() {
    hcaptchaToken = '';
    errorMessage = get(_)('auth.hCaptchaExpired');
  }

  async function handleSubmit() {
    errorMessage = '';
    
    if (!hcaptchaToken) {
      errorMessage = get(_)('auth.completeHCaptcha');
      return;
    }

    isLoading = true;

    try {
      if (isRegisterMode) {
        await authStore.register(email, password, name, hcaptchaToken);
      } else {
        await authStore.login(email, password, hcaptchaToken);
      }
      
      // Check if there's a saved redirect path (e.g., from verify-email)
      const savedRedirect = sessionStorage.getItem('redirectAfterLogin');
      if (savedRedirect) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(savedRedirect);
      } else {
        navigate('/');
      }
    } catch (error: any) {
      // Check for rate limiting (429 Too Many Requests)
      if (error.response?.status === 429) {
        errorMessage = get(_)('auth.tooManyAttempts');
      } else {
        errorMessage = error.message || get(_)('auth.authFailed');
      }
      // Reset hCaptcha on error
      if (hcaptchaComponent?.reset) {
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
          title="Please enter a valid email address"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {$_('auth.password')}
        </label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          minlength={isRegisterMode ? 8 : undefined}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="••••••••"
        />
        {#if !isRegisterMode}
          <div class="mt-1 text-right">
            <button
              type="button"
              on:click={() => navigate('/forgot-password')}
              disabled={!isOnline}
              class="text-xs text-primary hover:underline disabled:text-gray-400 disabled:cursor-not-allowed disabled:no-underline"
            >
              {$_('auth.forgotPassword')}
            </button>
          </div>
        {/if}
      </div>

      {#if HCAPTCHA_SITE_KEY}
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
        disabled={isLoading || !isOnline || (!hcaptchaToken && !!HCAPTCHA_SITE_KEY)}
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

    <div class="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
      <p>{$_('auth.offlineFirst')}</p>
    </div>
  </div>
</div>
