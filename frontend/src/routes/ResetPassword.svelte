<script lang="ts">
  import { authApi } from '../services/api';
  import { navigate } from '../lib/navigation';
  import { onMount } from 'svelte';

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
    if (tokenParam) {
      token = tokenParam;
      email = emailParam || ''; // Email is optional for backward compatibility
    } else {
      errorMessage = 'Invalid reset link. Please request a new password reset.';
    }
  });

  async function handleSubmit() {
    errorMessage = '';
    successMessage = '';

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      errorMessage = 'Passwords do not match';
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      errorMessage = 'Password must be at least 8 characters';
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
      errorMessage = error.message || 'Failed to reset password. The link may be invalid or expired.';
    } finally {
      isLoading = false;
    }
  }

  function goToLogin() {
    navigate('/login');
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
  <div class="w-full bg-white rounded-lg shadow-md p-8" style="max-width: 500px;">
    <h1 class="text-3xl font-bold text-center text-gray-800 mb-6">
      Reset Password
    </h1>

    {#if errorMessage}
      <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
        {errorMessage}
      </div>
    {/if}

    {#if successMessage}
      <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
        {successMessage}
        <p class="text-sm mt-2">Redirecting to login...</p>
      </div>
    {/if}

    {#if !errorMessage || token}
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
          <label for="newPassword" class="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            bind:value={newPassword}
            required
            minlength="8"
            disabled={isLoading || !!successMessage}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="••••••••"
          />
          <p class="text-xs text-gray-500 mt-1">At least 8 characters</p>
        </div>

        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            bind:value={confirmPassword}
            required
            minlength="8"
            disabled={isLoading || !!successMessage}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !!successMessage}
          class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    {/if}

    <div class="mt-6 text-center">
      <button
        on:click={goToLogin}
        class="text-blue-600 hover:underline text-sm"
      >
        Back to Login
      </button>
    </div>
  </div>
</div>
