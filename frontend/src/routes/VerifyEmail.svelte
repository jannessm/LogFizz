<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../stores/auth';
  import { snackbar } from '../stores/snackbar';
  import { navigate } from '../lib/navigation';
  import { authApi } from '../services/api';
  import { _ } from '../lib/i18n';

  let isVerifying = true;
  let verificationToken = '';
  let savedPath = '';
  let errorType: 'wrong_user' | 'expired' | 'generic' | null = null;

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
    errorType = null;
    
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
      const errorCode = error.response?.data?.code;
      
      console.log('Verification error:', error);
      
      if (error.response?.status === 429) {
        // Rate limit exceeded
        errorType = 'expired';
      } else if (errorCode === 'WRONG_USER') {
        // User is logged in as a different account - email already resent
        errorType = 'wrong_user';
      } else if (error.response?.status === 401) {
        // Not authenticated
        snackbar.error('Please log in first to verify your email.', 8000);
        // The onMount logic will handle redirecting to login
        navigate('/login');
        return;
      } else {
        // Generic error
        errorType = 'expired';
      }
      
      isVerifying = false;
      
      // Auto-redirect after showing the message
      if (errorType === 'expired') {
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
      
    } finally {
      if (errorType !== 'wrong_user' && errorType !== 'expired') {
        isVerifying = false;
      }
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

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
    {#if isVerifying}
      <!-- Verifying state -->
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 dark:border-orange-500 mx-auto mb-6"></div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{$_('verifyEmail.verifying')}</h1>
        <p class="text-gray-600 dark:text-gray-400">
          {$_('verifyEmail.pleaseWait')}
        </p>
      </div>
    {:else if errorType === 'wrong_user'}
      <!-- Wrong user error state -->
      <div class="text-center">
        <div class="mb-6">
          <span class="w-16 h-16 icon-[si--mail-duotone] text-blue-600 dark:text-orange-500 mx-auto block"></span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">{$_('verifyEmail.wrongAccount')}</h1>
        <p class="text-gray-700 dark:text-gray-300 mb-4">
          {$_('verifyEmail.wrongAccountDescription')} 
          {$_('verifyEmail.currentlyLoggedAs')} <strong>{user?.email}</strong>.
        </p>
        
        <div class="text-left text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-6">
          <p><strong class="dark:text-gray-200">{$_('verifyEmail.nextSteps')}</strong></p>
          <ol class="list-decimal list-inside space-y-1 ml-2">
            <li>{$_('verifyEmail.step1')}</li>
            <li>{$_('verifyEmail.step2')}</li>
            <li>{$_('verifyEmail.step3')}</li>
          </ol>
        </div>
        
        <button
          on:click={() => navigate('/')}
          class="w-full bg-blue-600 dark:bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
        >
          {$_('verifyEmail.goToDashboard')}
        </button>
      </div>
    {:else if errorType === 'expired'}
      <!-- Expired/invalid token error state -->
      <div class="text-center">
        <div class="mb-6">
          <span class="w-16 h-16 icon-[si--close-circle-line] text-red-600 dark:text-red-400 mx-auto block"></span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{$_('verifyEmail.verificationFailed')}</h1>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          {$_('verifyEmail.invalidOrExpired')}
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-500">
          {$_('verifyEmail.redirecting')}
        </p>
      </div>
    {:else}
      <!-- Success state (will show briefly before redirect) -->
      <div class="text-center">
        <div class="mb-6">
          <span class="w-16 h-16 icon-[si--check-circle-line] text-green-600 dark:text-green-400 mx-auto block"></span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{$_('verifyEmail.processing')}</h1>
        <p class="text-gray-600 dark:text-gray-400">
          {$_('verifyEmail.redirectingDashboard')}
        </p>
      </div>
    {/if}
  </div>
</div>
