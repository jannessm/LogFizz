<script lang="ts">
  import { authStore } from '../stores/auth';
  import { navigate } from '../lib/navigation';

  let email = '';
  let password = '';
  let name = '';
  let state = '';
  let isRegisterMode = false;
  let errorMessage = '';
  let isLoading = false;

  // German states (Bundesländer)
  const germanStates = [
    'Baden-Württemberg',
    'Bayern',
    'Berlin',
    'Brandenburg',
    'Bremen',
    'Hamburg',
    'Hessen',
    'Mecklenburg-Vorpommern',
    'Niedersachsen',
    'Nordrhein-Westfalen',
    'Rheinland-Pfalz',
    'Saarland',
    'Sachsen',
    'Sachsen-Anhalt',
    'Schleswig-Holstein',
    'Thüringen',
  ];

  async function handleSubmit() {
    errorMessage = '';
    isLoading = true;

    try {
      if (isRegisterMode) {
        await authStore.register(email, password, name, state || undefined);
      } else {
        await authStore.login(email, password);
      }
      navigate('/');
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
      {isRegisterMode ? 'Register' : 'Login'} to Clock
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
          <label for="state" class="block text-sm font-medium text-gray-700 mb-1">
            State (optional)
          </label>
          <select
            id="state"
            bind:value={state}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a state --</option>
            {#each germanStates as germanState}
              <option value={germanState}>{germanState}</option>
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
