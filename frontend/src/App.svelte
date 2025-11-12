<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from './stores/auth';
  import Login from './routes/Login.svelte';
  import Dashboard from './routes/Dashboard.svelte';
  import History from './routes/History.svelte';
  import Settings from './routes/Settings.svelte';
  import { syncService } from './services/sync';
  import { currentPath, navigate } from './lib/navigation';

  let isLoading = true;

  $: auth = $authStore;
  $: path = $currentPath;

  onMount(async () => {
    await authStore.init();
    isLoading = false;

    // Auto-sync every 5 minutes if online
    setInterval(() => {
      if (navigator.onLine) {
        syncService.syncAll();
      }
    }, 5 * 60 * 1000);
  });

  // Redirect to login if not authenticated
  $: {
    if (!isLoading && !auth.isAuthenticated && path !== '/login') {
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
  {:else if path === '/history'}
    <History />
  {:else if path === '/settings'}
    <Settings />
  {:else}
    <Dashboard />
  {/if}
{/if}
