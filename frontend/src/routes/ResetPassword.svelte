<script lang="ts">
  import { authApi } from '../services/api';
  import { navigate } from '../lib/navigation';
  import { onMount } from 'svelte';
  import { _ } from '../lib/i18n';
  import { get } from 'svelte/store';

  let token = '';
  let email = '';
  let newPassword = '';
  let confirmPassword = '';
  let errorMessage = '';
  let successMessage = '';
  let isLoading = false;

  onMount(() => {
    // Get token and email from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const emailParam = urlParams.get('email');
    if (tokenParam && emailParam) {
      token = tokenParam;
      email = emailParam;
    } else {
      errorMessage = get(_)('resetPassword.invalidToken');
    }
  });

  async function handleSubmit() {
    errorMessage = '';
    successMessage = '';

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      errorMessage = get(_)('settings.passwordMismatch');
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      errorMessage = get(_)('auth.passwordMinLength');
      return;
    }

    isLoading = true;

    try {
      const response = await authApi.resetPassword(token, newPassword, email);
      successMessage = response.message;
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      // Check for rate limiting (429 Too Many Requests)
      if (error.response?.status === 429) {
        errorMessage = get(_)('auth.tooManyPasswordResetAttempts');
      } else {
        errorMessage = error.message || get(_)('resetPassword.invalidToken');
      }
    } finally {
      isLoading = false;
    }
  }

  function goToLogin() {
    navigate('/login');
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8" style="max-width: 500px;">
    <h1 class="text-3xl font-bold text-center text-gray-800 dark:text-gray-100 mb-6">
      {$_('resetPassword.title')}
    </h1>

    {#if errorMessage}
      <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded">
        {errorMessage}
      </div>
    {/if}

    {#if successMessage}
      <div class="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 rounded">
        {successMessage}
        <p class="text-sm mt-2">{$_('verifyEmail.redirecting')}</p>
      </div>
    {/if}

    {#if !errorMessage || token}
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
          <label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {$_('settings.newPassword')}
          </label>
          <input
            id="newPassword"
            type="password"
            bind:value={newPassword}
            required
            minlength="8"
            disabled={isLoading || !!successMessage}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="••••••••"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{$_('auth.passwordMinLength')}</p>
        </div>

        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {$_('settings.confirmPassword')}
          </label>
          <input
            id="confirmPassword"
            type="password"
            bind:value={confirmPassword}
            required
            minlength="8"
            disabled={isLoading || !!successMessage}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !!successMessage}
          class="w-full bg-blue-600 dark:bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-orange-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? $_('common.loading') : $_('resetPassword.submit')}
        </button>
      </form>
    {/if}

    <div class="mt-6 text-center">
      <button
        on:click={goToLogin}
        class="text-blue-600 dark:text-orange-400 hover:underline text-sm"
      >
        {$_('forgotPassword.backToLogin')}
      </button>
    </div>
  </div>
</div>
