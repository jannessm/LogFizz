<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../stores/auth';
  import { snackbar } from '../stores/snackbar';
  import { navigate, currentPath } from '../lib/navigation';
  import { authApi } from '../services/api';

  let isVerifying = true;
  let verificationToken = '';
  let savedPath = '';

  $: user = $authStore.user;
  $: isAuthenticated = $authStore.isAuthenticated;

  onMount(async () => {
    // Get token from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    verificationToken = urlParams.get('token') || '';

    if (!verificationToken) {
      snackbar.error('No verification token provided');
      navigate('/login');
      return;
    }

    // If user is not authenticated, save the current path and redirect to login
    if (!isAuthenticated) {
      // Save the verification URL for after login
      savedPath = window.location.pathname + window.location.search;
      sessionStorage.setItem('redirectAfterLogin', savedPath);
      
      snackbar.info('Please log in to verify your email', 7000);
      navigate('/login');
      return;
    }

    // User is authenticated, proceed with verification
    await verifyEmail();
  });

  async function verifyEmail() {
    isVerifying = true;
    
    try {
      const response = await authApi.verifyEmail(verificationToken);
      
      // Refresh user data to get updated email_verified_at
      await authStore.init();
      
      snackbar.success(response.message || 'Email verified successfully!', 6000);
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/');
      }, 1500);
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 
                          error.message || 
                          'Email verification failed';
      
      console.log('Verification error:', error);
      snackbar.error('The verification link is invalid or has expired.', 8000);
      
      // Redirect to dashboard after error
      setTimeout(() => {
        navigate('/');
      }, 3000);
      
    } finally {
      isVerifying = false;
    }
  }

  // Check if we should retry verification after login
  onMount(() => {
    const checkRetryVerification = async () => {
      // Wait for auth to be loaded
      if ($authStore.isLoading) {
        setTimeout(checkRetryVerification, 100);
        return;
      }

      const savedRedirect = sessionStorage.getItem('redirectAfterLogin');
      
      if (isAuthenticated && savedRedirect && savedRedirect.includes('verify-email')) {
        // Clear the saved redirect
        sessionStorage.removeItem('redirectAfterLogin');
        
        // Extract token from saved URL
        const urlParams = new URLSearchParams(savedRedirect.split('?')[1]);
        const token = urlParams.get('token');
        
        if (token && !isVerifying) {
          verificationToken = token;
          await verifyEmail();
        }
      }
    };

    checkRetryVerification();
  });
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
  <div class="max-w-md w-full bg-white rounded-lg shadow-md p-8">
    {#if isVerifying}
      <!-- Verifying state -->
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
        <h1 class="text-2xl font-bold text-gray-800 mb-2">Verifying Email</h1>
        <p class="text-gray-600">
          Please wait while we verify your email address...
        </p>
      </div>
    {:else}
      <!-- Success/Error state (will show briefly before redirect) -->
      <div class="text-center">
        <div class="mb-6">
          <span class="w-16 h-16 icon-[si--check-circle-line] text-green-600 mx-auto block"></span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800 mb-2">Processing...</h1>
        <p class="text-gray-600">
          Redirecting you to the dashboard...
        </p>
      </div>
    {/if}
  </div>
</div>
