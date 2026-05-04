<script lang="ts">
  import { authStore } from '../stores/auth';
  import { navigate } from '../lib/navigation';
  import HCaptcha from '../components/HCaptcha.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { _ } from '../lib/i18n';
  import { get } from 'svelte/store';
  import { snackbar } from '../stores/snackbar';

  let email = '';
  let name = '';
  let isRegisterMode = false;
  let errorMessage = '';
  let isLoading = false;
  let hcaptchaToken = '';
  let hcaptchaComponent: { reset: () => void } | undefined = undefined;
  let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Code-entry state
  let codeSent = false;
  let otpCode = '';
  let isVerifying = false;
  let resendCooldown = 0;
  let resendTimer: ReturnType<typeof setInterval> | undefined;

  const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY || '';

  function updateOnlineStatus() {
    if (typeof navigator !== 'undefined') {
      isOnline = navigator.onLine;
    }
  }

  onMount(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    // Pre-select register mode if the URL contains ?register=true
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('register') === 'true') {
        isRegisterMode = true;
      }
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    }
    if (resendTimer) clearInterval(resendTimer);
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

  function startResendCooldown() {
    resendCooldown = 60;
    resendTimer = setInterval(() => {
      resendCooldown--;
      if (resendCooldown <= 0) {
        clearInterval(resendTimer);
        resendTimer = undefined;
      }
    }, 1000);
  }

  async function handleSubmit() {
    errorMessage = '';

    if (isRegisterMode) {
      if (!hcaptchaToken && HCAPTCHA_SITE_KEY) {
        errorMessage = $_('auth.completeHCaptcha');
        return;
      }
    }

    isLoading = true;

    try {
      if (isRegisterMode) {
        await authStore.register(email, name, hcaptchaToken);
        snackbar.success($_('auth.registrationSuccess'));
        // Switch to login/code-entry mode for the registered email
        isRegisterMode = false;
      }
      await authStore.requestMagicLink(email);
      codeSent = true;
      startResendCooldown();
    } catch (error: any) {
      if (error.response?.status === 429) {
        errorMessage = $_('auth.tooManyAttempts');
      } else {
        errorMessage = error.message || $_('auth.authFailed');
      }
      if (isRegisterMode && hcaptchaComponent?.reset) {
        hcaptchaComponent.reset();
      }
      hcaptchaToken = '';
    } finally {
      isLoading = false;
    }
  }

  async function handleVerifyCode() {
    errorMessage = '';
    isVerifying = true;
    try {
      await authStore.verifyMagicLink(otpCode.toUpperCase().trim());
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
        : $_('auth.invalidCode');
      otpCode = '';
    } finally {
      isVerifying = false;
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    errorMessage = '';
    isLoading = true;
    try {
      await authStore.requestMagicLink(email);
      startResendCooldown();
      otpCode = '';
    } catch (error: any) {
      errorMessage = error.response?.status === 429
        ? $_('auth.tooManyAttempts')
        : error.message || $_('auth.authFailed');
    } finally {
      isLoading = false;
    }
  }

  function toggleMode() {
    isRegisterMode = !isRegisterMode;
    errorMessage = '';
    codeSent = false;
    otpCode = '';
    hcaptchaToken = '';
    if (hcaptchaComponent?.reset) {
      hcaptchaComponent.reset();
    }
  }

  function backToEmail() {
    codeSent = false;
    otpCode = '';
    errorMessage = '';
    if (resendTimer) {
      clearInterval(resendTimer);
      resendTimer = undefined;
    }
    resendCooldown = 0;
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8" style="max-width: 500px;">
    <h1 class="text-3xl font-bold text-center text-gray-800 dark:text-gray-100 mb-6">
      {isRegisterMode ? $_('auth.registerToLogFizz') : $_('auth.loginToLogFizz')}
    </h1>

    {#if errorMessage}
      <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded">
        {errorMessage}
      </div>
    {/if}

    {#if codeSent}
      <!-- Code entry form -->
      <div class="space-y-4">
        <div class="flex justify-center mb-2">
          <svg class="w-14 h-14 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p class="text-gray-700 dark:text-gray-300 text-base text-center">
          {$_('auth.magicLinkSent')}
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 text-center">
          {email}
        </p>

        <form on:submit|preventDefault={handleVerifyCode} class="space-y-3 mt-2">
          <div>
            <label for="otp" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {$_('auth.enterCode')}
            </label>
            <input
              id="otp"
              type="text"
              bind:value={otpCode}
              maxlength="6"
              autocomplete="one-time-code"
              required
              class="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary text-center text-2xl font-mono tracking-widest uppercase"
              placeholder={$_('auth.codePlaceholder')}
            />
          </div>

          <button
            type="submit"
            disabled={isVerifying || !isOnline || otpCode.trim().length < 6}
            class="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-hover disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {isVerifying ? $_('auth.pleaseWait') : $_('auth.verifyCode')}
          </button>
        </form>

        <div class="flex items-center justify-between pt-2">
          <button
            on:click={backToEmail}
            class="text-sm text-gray-500 dark:text-gray-400 hover:underline"
          >
            {$_('auth.backToLogin')}
          </button>
          <button
            on:click={handleResend}
            disabled={resendCooldown > 0 || isLoading || !isOnline}
            class="text-sm text-primary hover:underline disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            {resendCooldown > 0
              ? $_('auth.resendCodeIn', { values: { seconds: resendCooldown } })
              : $_('auth.resendCode')}
          </button>
        </div>
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
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {isRegisterMode ? $_('auth.hasAccount') : $_('auth.noAccount')}
        </p>
        <button
          on:click={toggleMode}
          disabled={!isOnline}
          class="w-full py-2 px-4 rounded-md text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRegisterMode ? $_('auth.switchToLogin') : $_('auth.switchToRegister')}
        </button>
      </div>
    {/if}
  </div>
</div>
