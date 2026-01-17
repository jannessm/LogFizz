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

<div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
  <div class="w-full bg-white rounded-lg shadow-md p-8" style="max-width: 500px;">
    <h1 class="text-3xl font-bold text-center text-gray-800 mb-6">
      Forgot Password
    </h1>

    <p class="text-sm text-gray-600 mb-6 text-center">
      Enter your email address and we'll send you a link to reset your password.
    </p>

    {#if errorMessage}
      <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
        {errorMessage}
      </div>
    {/if}

    {#if successMessage}
      <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
        {successMessage}
      </div>
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
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
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          placeholder="your@email.com"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !!successMessage || !isOnline}
        class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
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
        class="text-blue-600 hover:underline text-sm"
      >
        Back to Login
      </button>
    </div>
  </div>
</div>
