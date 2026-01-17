<script lang="ts">
  let {
    hasPendingSync = false,
    isOnline = true,
    onsync
  }: {
    hasPendingSync?: boolean;
    isOnline?: boolean;
    onsync: () => void;
  } = $props();

  function handleSync() {
    onsync();
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
  <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Sync Status</h2>
  
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm flex items-center gap-2">
        {#if isOnline}
          <svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
          </svg>
          <span class="text-gray-600 dark:text-gray-400">Online</span>
        {:else}
          <svg class="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
          </svg>
          <span class="text-gray-600 dark:text-gray-400">Offline</span>
        {/if}
      </p>
      {#if hasPendingSync}
        <p class="text-sm text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
          <span class="icon-[si--alert-duotone]" style="width: 24px; height: 24px;"></span>
          Pending changes to sync
        </p>
      {:else}
        <p class="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
          <span class="icon-[si--check-line]" style="width: 24px; height: 24px;"></span>
          All synced
        </p>
      {/if}
    </div>
    <button
      onclick={handleSync}
      disabled={!isOnline}
      class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors flex items-center gap-2"
    >
      <span class="w-5 h-5 icon-[si--cloud-line]"></span>
      Sync Now
    </button>
  </div>
</div>
