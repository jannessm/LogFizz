<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let hasPendingSync: boolean = false;
  export let isOnline: boolean = true;

  const dispatch = createEventDispatcher();

  function handleSync() {
    dispatch('sync');
  }
</script>

<div class="bg-white rounded-lg shadow-md p-6 mb-6">
  <h2 class="text-xl font-semibold text-gray-800 mb-4">Sync Status</h2>
  
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm flex items-center gap-2">
        {#if isOnline}
          <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
          </svg>
          <span class="text-gray-600">Online</span>
        {:else}
          <svg class="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
          </svg>
          <span class="text-gray-600">Offline</span>
        {/if}
      </p>
      {#if hasPendingSync}
        <p class="text-sm text-yellow-600 mt-1 flex items-center gap-1">
          <span class="icon-[si--alert-duotone]" style="width: 24px; height: 24px;"></span>
          Pending changes to sync
        </p>
      {:else}
        <p class="text-sm text-green-600 mt-1 flex items-center gap-1">
          <span class="icon-[si--check-line]" style="width: 24px; height: 24px;"></span>
          All synced
        </p>
      {/if}
    </div>
    <button
      on:click={handleSync}
      disabled={!isOnline}
      class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
    >
      <span class="w-5 h-5 icon-[si--cloud-line]"></span>
      Sync Now
    </button>
  </div>
</div>
