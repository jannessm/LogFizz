<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../stores/auth';
  import { statesStore } from '../stores/states';
  import { navigate } from '../lib/navigation';


  let email = '';
  let password = '';
  let name = '';
  let country = 'DE';
  let state = '';
  let isRegisterMode = false;
  let errorMessage = '';
  let isLoading = false;
  let countries = [
    { code: 'DE', name: 'Germany' },
  ];
  let states: Array<{ country: string; code: string; state: string }> = [];
  let filteredStates: Array<{ country: string; code: string; state: string }> = [];

  $: if (!!$statesStore.states && $statesStore.states.length > 0) {
    states = $statesStore.states;
    const selectedCountry = countries.filter(c => c.code === country)[0].name;
    filteredStates = states.filter(s => s.country === selectedCountry)
                           .sort((a, b) => a.state.localeCompare(b.state));
  }

  onMount(async () => {
    await statesStore.load();
  });

  async function handleSubmit() {
    errorMessage = '';
    isLoading = true;

    try {
      if (isRegisterMode) {
        await authStore.register(email, password, name, state || undefined);
      } else {
        await authStore.login(email, password);
      }
      
      // Check if there's a saved redirect path (e.g., from verify-email)
      const savedRedirect = sessionStorage.getItem('redirectAfterLogin');
      if (savedRedirect) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(savedRedirect);
      } else {
        navigate('/');
      }
    } catch (error: any) {
      errorMessage = error.message || 'Authentication failed';
    } finally {
      isLoading = false;
    }
  }

  function toggleMode() {
    isRegisterMode = !isRegisterMode;
    errorMessage = '';
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
  <div class="w-full bg-white rounded-lg shadow-md p-8" style="max-width: 500px;">
    <h1 class="text-3xl font-bold text-center text-gray-800 mb-6">
      {isRegisterMode ? 'Register' : 'Login'} to TapShift
    </h1>

    {#if errorMessage}
      <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
        {errorMessage}
      </div>
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      {#if isRegisterMode}
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            bind:value={name}
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your name"
          />
        </div>

        <div>
          <p>To include public holidays in the calculation of working hours, please select your location:</p>
          <label for="country" class="block text-sm font-medium text-gray-700 mb-1">
            Country (optional)
          </label>
          <select
            id="country"
            bind:value={country}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a country --</option>
            <option value='DE'>Germany</option>
          </select>
        </div>

        <div>
          <label for="state" class="block text-sm font-medium text-gray-700 mb-1">
            State (optional)
          </label>
          <select
            id="state"
            bind:value={state}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a state --</option>
            {#each filteredStates as filteredState}
              <option value={filteredState.code}>{filteredState.state}</option>
            {/each}
          </select>
        </div>
      {/if}

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
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          minlength={isRegisterMode ? 8 : undefined}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="••••••••"
        />
        {#if !isRegisterMode}
          <div class="mt-1 text-right">
            <button
              type="button"
              on:click={() => navigate('/forgot-password')}
              class="text-xs text-blue-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        {/if}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Please wait...' : isRegisterMode ? 'Register' : 'Login'}
      </button>
    </form>

    <div class="mt-6 text-center">
      <button
        on:click={toggleMode}
        class="text-blue-600 hover:underline text-sm"
      >
        {isRegisterMode 
          ? 'Already have an account? Login' 
          : "Don't have an account? Register"}
      </button>
    </div>

    <div class="mt-4 text-center text-xs text-gray-500">
      <p>Offline-first • Your data is stored locally</p>
    </div>
  </div>
</div>
