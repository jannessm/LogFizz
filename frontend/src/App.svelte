<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from './stores/auth';
  import { themeStore } from './stores/theme';
  import { userSettingsStore } from './stores/userSettings';
  import { setLocale } from './lib/i18n';
  import { setDayjsLocale } from './lib/dateFormatting';
  import Login from './routes/Login.svelte';
  import Dashboard from './routes/Dashboard.svelte';
  import History from './routes/History.svelte';
  import Table from './routes/Table.svelte';
  import WeekView from './routes/WeekView.svelte';
  import Settings from './routes/Settings.svelte';
  import ForgotPassword from './routes/ForgotPassword.svelte';
  import ResetPassword from './routes/ResetPassword.svelte';
  import VerifyEmail from './routes/VerifyEmail.svelte';
  import VerifyEmailRequired from './routes/VerifyEmailRequired.svelte';
  import { ImportPage } from './routes/import';
  import { ExportPage } from './routes/export';
  import Payment from './routes/Payment.svelte';
  import PaymentSuccess from './routes/PaymentSuccess.svelte';
  import Snackbar from './components/Snackbar.svelte';
  import SetupModal from './components/SetupModal.svelte';
  import { syncService } from './services/sync';
  import { currentPath, navigate } from './lib/navigation';
  import { loadData } from './services/data';
  import { getDB, getSetting } from './lib/db';
  import { snackbar } from './stores/snackbar';

  let isLoading = $state(true);
  let showSetupModal = $state(false);
  const skipEmailVerification = import.meta.env.VITE_SKIP_EMAIL_VERIFICATION === 'true';
  console.log('Skip Email Verification:', skipEmailVerification);

  let authenticated = $derived($authStore.isAuthenticated);
  let user = $derived($authStore.user);
  let emailVerified = $derived(!!user?.email_verified_at || skipEmailVerification);
  let path = $derived($currentPath);

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/forgot-password', '/reset-password', '/verify-email'];
  const isPublicRoute = (path: string) => publicRoutes.includes(path);
  
  // Routes that are allowed even without email verification (need auth but no verification)
  const verificationExemptRoutes = ['/verify-email-required', '/verify-email'];
  const isVerificationExempt = (path: string) => verificationExemptRoutes.some(r => path.startsWith(r));

  async function checkAndShowSetupModal() {
    const settings = $userSettingsStore.settings;
    if (settings?.language) {
      setLocale(settings.language);
    }
    if (settings?.locale) {
      setDayjsLocale(settings.locale);
    }

    // Check if setup has been completed on this device
    if (!userSettingsStore.setupDone()) {
      showSetupModal = true;
    }
  }

  onMount(async () => {
    await getDB(); // ensure DB is initialized
    await authStore.init();
    await themeStore.init();
    await loadData(authenticated); // initializes all necessary data stores if logged in
    
    // Initialize user settings and set i18n locale if authenticated
    if (authenticated) {
      await checkAndShowSetupModal();
    }
    
    isLoading = false;

    // Auto-sync every minute if online and authenticated
    setInterval(() => {
      if (navigator.onLine && authenticated) {
        syncService.sync('all');
      }
    }, 1 * 60 * 1000);

    // Sync when the tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && authenticated) {
        syncService.sync('all');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });

  // Redirect to login if not authenticated and not on a public route
  $effect(() => {
    if (!isLoading && !authenticated && !isPublicRoute(path)) {
      navigate('/login', { replace: true });
    }
  });
  
  // Redirect to email verification if authenticated but email not verified
  $effect(() => {
    if (!isLoading && authenticated && !emailVerified && !isVerificationExempt(path)) {
      navigate('/verify-email-required', { replace: true });
    }
  });

  // Load data when authenticated
  $effect(() => {
    if (!isLoading && authenticated) {
      loadData(true); // ensure data is loaded when authenticated
    }
  });

  // Redirect to dashboard if authenticated and on a public route (but not verification routes)
  $effect(() => {
    if (!isLoading && authenticated && isPublicRoute(path) && !isVerificationExempt(path)) {
      if (path.startsWith('/reset-password')) {
        snackbar.info('To reset your password, logout first.', 6000);
      }
      navigate('/', { replace: true });
    }
  });
  
  // Redirect away from verification required page if already verified
  $effect(() => {
    if (!isLoading && authenticated && emailVerified && path.startsWith('/verify-email-required')) {
      navigate('/', { replace: true });
    }
  });

  // Check whether the setup modal should be shown after login/registration
  $effect(() => {
    if (!isLoading && authenticated && emailVerified && !showSetupModal) {
      checkAndShowSetupModal();
    }
  });

  function handleSetupComplete() {
    showSetupModal = false;
  }
</script>

{#if isLoading}
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      <p class="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
{:else}
  {#if path.startsWith('/login')}
    <Login />
  {:else if path.startsWith('/forgot-password')}
    <ForgotPassword />
  {:else if path.startsWith('/reset-password')}
    <ResetPassword />
  {:else if path.startsWith('/verify-email-required')}
    <VerifyEmailRequired />
  {:else if path.startsWith('/verify-email')}
    <VerifyEmail />
  {:else if path.startsWith('/payment')}
    <Payment />
  {:else if path.startsWith('/payment/success')}
    <PaymentSuccess />
  {:else if path.startsWith('/history')}
    <History />
  {:else if path.startsWith('/week')}
    <WeekView />
  {:else if path.startsWith('/import')}
    <ImportPage />
  {:else if path.startsWith('/export')}
    <ExportPage />
  {:else if path.startsWith('/table')}
    <Table />
  {:else if path.startsWith('/settings')}
    <Settings />
  {:else}
    <Dashboard />
  {/if}
{/if}

<!-- Global Snackbar component -->
<Snackbar />

<!-- Setup Modal - shown once on first visit for authenticated users -->
{#if showSetupModal && authenticated && emailVerified}
  <SetupModal oncomplete={handleSetupComplete} />
{/if}
