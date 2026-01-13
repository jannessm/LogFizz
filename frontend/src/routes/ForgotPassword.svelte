<script lang="ts">
  import { authApi } from '../services/api';
  import { navigate } from '../lib/navigation';
  import { onMount, onDestroy } from 'svelte';

  let email = '';
  let errorMessage = '';
  let successMessage = '';
  let isLoading = false;
  let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

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

  async function handleSubmit() {
    errorMessage = '';
    successMessage = '';
    isLoading = true;

    try {
      const response = await authApi.forgotPassword(email);
      successMessage = response.message;
      email = '';
    } catch (error: any) {
      // Check for rate limiting (429 Too Many Requests)
      if (error.response?.status === 429) {
        errorMessage = 'Too many password reset attempts. Please wait 15 minutes before trying again.';
      } else {
        errorMessage = error.message || 'Failed to send reset email';
      }
    } finally {
      isLoading = false;
    }
  }

  function goBack() {
    navigate('/login');
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
  <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8" style="max-width: 500px;">
    <h1 class="text-3xl font-bold text-center text-gray-800 dark:text-gray-100 mb-6">
      Forgot Password
    </h1>

    <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
      Enter your email address and we'll send you a link to reset your password.
    </p>

    {#if errorMessage}
      <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded">
        {errorMessage}
      </div>
    {/if}

    {#if successMessage}
      <div class="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 rounded">
        {successMessage}
      </div>
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]&#123;2,&#125;"
          title="Please enter a valid email address"
          disabled={isLoading || !!successMessage || !isOnline}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="your@email.com"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !!successMessage || !isOnline}
        class="w-full bg-blue-600 dark:bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-orange-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
      >
        {#if !isOnline}
          Offline
        {:else}
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        {/if}
      </button>
    </form>

    <div class="mt-6 text-center">
      <button
        on:click={goBack}
        class="text-blue-600 dark:text-orange-400 hover:underline text-sm"
      >
        Back to Login
      </button>
    </div>
  </div>
</div>
