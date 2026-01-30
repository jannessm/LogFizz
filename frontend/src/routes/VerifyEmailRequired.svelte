<script lang="ts">
  import { authStore } from '../stores/auth';
  import { navigate } from '../lib/navigation';
  import { snackbar } from '../stores/snackbar';

  let isResending = $state(false);
  let resendCooldown = $state(0);
  let cooldownInterval: ReturnType<typeof setInterval> | null = null;

  let user = $derived($authStore.user);

  async function handleResendVerification() {
    if (isResending || resendCooldown > 0 || !user?.email) return;
    
    isResending = true;
    try {
      await authStore.resendVerification(user.email);
      snackbar.success('Verification email sent! Please check your inbox.');
      // Start cooldown
      resendCooldown = 60;
      cooldownInterval = setInterval(() => {
        resendCooldown--;
        if (resendCooldown <= 0 && cooldownInterval) {
          clearInterval(cooldownInterval);
          cooldownInterval = null;
        }
      }, 1000);
    } catch (error: any) {
      snackbar.error(error.message || 'Failed to send verification email');
    } finally {
      isResending = false;
    }
  }

  async function handleLogout() {
    await authStore.logout();
    navigate('/login');
  }

  async function handleRefreshStatus() {
    // Re-initialize auth to check if email is now verified
    await authStore.init();
    if ($authStore.user?.email_verified_at) {
      snackbar.success('Email verified! Redirecting...');
      setTimeout(() => navigate('/'), 1000);
    } else {
      snackbar.info('Email not yet verified');
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
  <div class="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
    <div class="text-center">
      <!-- Email icon -->
      <div class="mb-6">
        <span class="w-20 h-20 icon-[si--mail-duotone] text-primary mx-auto block"></span>
      </div>
      
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
        Verify Your Email
      </h1>
      
      <p class="text-gray-600 dark:text-gray-400 mb-2">
        Please verify your email address to continue using TapShift.
      </p>
      
      <p class="text-sm text-gray-500 dark:text-gray-500 mb-6">
        We've sent a verification link to <strong class="text-gray-700 dark:text-gray-300">{user?.email}</strong>
      </p>

      <div class="space-y-3">
        <button
          onclick={handleResendVerification}
          disabled={isResending || resendCooldown > 0}
          class="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-hover disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {#if isResending}
            <span class="w-5 h-5 icon-[svg-spinners--3-dots-fade]"></span>
            Sending...
          {:else if resendCooldown > 0}
            Resend in {resendCooldown}s
          {:else}
            Resend Verification Email
          {/if}
        </button>

        <button
          onclick={handleRefreshStatus}
          class="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
        >
          <span class="w-5 h-5 icon-[si--refresh-line]"></span>
          I've Verified My Email
        </button>

        <button
          onclick={handleLogout}
          class="w-full text-red-600 dark:text-red-400 py-2 px-4 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
        >
          <span class="w-5 h-5 icon-[si--sign-out-line]"></span>
          Sign Out
        </button>
      </div>

      <div class="mt-6 text-xs text-gray-500 dark:text-gray-500">
        <p>Didn't receive the email? Check your spam folder.</p>
      </div>
    </div>
  </div>
</div>
