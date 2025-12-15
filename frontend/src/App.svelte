<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from './stores/auth';
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

  let isLoading = true;

  $: auth = $authStore;
  $: path = $currentPath;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/forgot-password', '/reset-password', '/verify-email'];
  const isPublicRoute = (path: string) => publicRoutes.includes(path);

  onMount(async () => {
    await authStore.init();
    await loadData($authStore.isAuthenticated); // initializes all necessary data stores if logged in
    isLoading = false;

    // Auto-sync every minute if online and authenticated
    setInterval(() => {
      if (navigator.onLine && $authStore.isAuthenticated) {
        syncService.sync();
      }
    }, 1 * 60 * 1000);
  });

  // Redirect to login if not authenticated and not on a public route
  $: {
    if (!isLoading && !auth.isAuthenticated && !isPublicRoute(path)) {
      navigate('/login', { replace: true });
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
