<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from './stores/auth';
  import { get } from 'svelte/store';
  import { themeStore } from './stores/theme';
  import Login from './routes/Login.svelte';
  import Dashboard from './routes/Dashboard.svelte';
  import History from './routes/History.svelte';
  import Settings from './routes/Settings.svelte';
  import ForgotPassword from './routes/ForgotPassword.svelte';
  import ResetPassword from './routes/ResetPassword.svelte';
  import VerifyEmail from './routes/VerifyEmail.svelte';
  import Snackbar from './components/Snackbar.svelte';
  import { syncService } from './services/sync';
  import { currentPath, navigate } from './lib/navigation';
  import { loadData } from './services/data';
    import { getDB } from './lib/db';
    import { snackbar } from './stores/snackbar';

  let isLoading = true;

  $: authenticated = $authStore.isAuthenticated;
  $: path = $currentPath;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/forgot-password', '/reset-password', '/verify-email'];
  const isPublicRoute = (path: string) => publicRoutes.includes(path);

  onMount(async () => {
    await getDB(); // ensure DB is initialized
    await authStore.init();
    await themeStore.init();
    await loadData(authenticated); // initializes all necessary data stores if logged in
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
    if (!isLoading && !auth.isAuthenticated && !isPublicRoute(path)) {
      navigate('/login', { replace: true });
    }

    if (!isLoading && auth.isAuthenticated) {
      loadData(true); // ensure data is loaded when authenticated
    }

    // Redirect to dashboard if authenticated and on a public route
    if (!isLoading && auth.isAuthenticated && isPublicRoute(path)) {
      if (path === '/reset-password') {
        snackbar.info('To reset your password, logout first.', 6000);
      }
      navigate('/', { replace: true });
    }
  }
</script>

{#if isLoading}
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
{:else}
  {#if path === '/login'}
    <Login />
  {:else if path === '/forgot-password'}
    <ForgotPassword />
  {:else if path === '/reset-password'}
    <ResetPassword />
  {:else if path === '/verify-email'}
    <VerifyEmail />
  {:else if path === '/history'}
    <History />
  {:else if path === '/settings'}
    <Settings />
  {:else}
    <Dashboard />
  {/if}
{/if}

<!-- Global Snackbar component -->
<Snackbar />
