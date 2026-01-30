<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from './stores/auth';
  import { get } from 'svelte/store';
  import { themeStore } from './stores/theme';
  import { userSettingsStore } from './stores/userSettings';
  import { setLocale } from './lib/i18n';
  import { setDayjsLocale } from './lib/dateFormatting';
  import Login from './routes/Login.svelte';
  import Dashboard from './routes/Dashboard.svelte';
  import History from './routes/History.svelte';
  import Table from './routes/Table.svelte';
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
  import { syncService } from './services/sync';
  import { currentPath, navigate } from './lib/navigation';
  import { loadData } from './services/data';
  import { getDB } from './lib/db';
  import { snackbar } from './stores/snackbar';

  let isLoading = true;

  $: authenticated = $authStore.isAuthenticated;
  $: user = $authStore.user;
  $: emailVerified = !!user?.email_verified_at;
  $: path = $currentPath;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/forgot-password', '/reset-password', '/verify-email'];
  const isPublicRoute = (path: string) => publicRoutes.includes(path);
  
  // Routes that are allowed even without email verification (need auth but no verification)
  const verificationExemptRoutes = ['/verify-email-required', '/verify-email'];
  const isVerificationExempt = (path: string) => verificationExemptRoutes.some(r => path.startsWith(r));

  onMount(async () => {
    await getDB(); // ensure DB is initialized
    await authStore.init();
    await themeStore.init();
    await loadData(authenticated); // initializes all necessary data stores if logged in
    
    // Initialize user settings and set i18n locale if authenticated
    if (authenticated) {
      await userSettingsStore.init();
      const settings = get(userSettingsStore).settings;
      if (settings?.language) {
        setLocale(settings.language);
      }
      if (settings?.locale) {
        setDayjsLocale(settings.locale);
      }
    }
    
    isLoading = false;

    // Auto-sync every minute if online and authenticated
    setInterval(() => {
      if (navigator.onLine && authenticated) {
        syncService.sync('all');
      }
    }, 1 * 60 * 1000);
  });

  // Redirect to login if not authenticated and not on a public route
  $: {
    const auth = get(authStore);
    const currentUser = auth.user;
    const isEmailVerified = !!currentUser?.email_verified_at;
    
    if (!isLoading && !auth.isAuthenticated && !isPublicRoute(path)) {
      navigate('/login', { replace: true });
    }

    if (!isLoading && auth.isAuthenticated) {
      loadData(true); // ensure data is loaded when authenticated
    }

    // Redirect to dashboard if authenticated and on a public route
    if (!isLoading && auth.isAuthenticated && isPublicRoute(path)) {
      if (path.startsWith('/reset-password')) {
        snackbar.info('To reset your password, logout first.', 6000);
      }
      navigate('/', { replace: true });
    }
    
    // Redirect to email verification if authenticated but email not verified
    if (!isLoading && auth.isAuthenticated && !isEmailVerified && !isVerificationExempt(path) && !isPublicRoute(path)) {
      navigate('/verify-email-required', { replace: true });
    }
    
    // Redirect away from verification required page if already verified
    if (!isLoading && auth.isAuthenticated && isEmailVerified && path.startsWith('/verify-email-required')) {
      navigate('/', { replace: true });
    }
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
