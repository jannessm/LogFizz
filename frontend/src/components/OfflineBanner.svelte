<script lang="ts">
  import { _, isLoading } from 'svelte-i18n';

  let isOffline = $state(false);
  let slim = $state(false);
  let slimTimer: ReturnType<typeof setTimeout> | null = null;

  function onOffline() {
    isOffline = true;
    slim = false;
    if (slimTimer) clearTimeout(slimTimer);
    slimTimer = setTimeout(() => { slim = true; }, 1000);
  }

  function onOnline() {
    isOffline = false;
    slim = false;
    if (slimTimer) { clearTimeout(slimTimer); slimTimer = null; }
  }

  setInterval(() => {
    if (typeof navigator !== 'undefined') {
      const currentlyOffline = !navigator.onLine;
      if (currentlyOffline !== isOffline) {
        if (currentlyOffline) {
          onOffline();
        } else {
          onOnline();
        }
      }
    }
  }, 5000); // Check every 5 seconds in case events were missed
</script>

{#if isOffline}
  <div
    class="fixed top-0 left-0 right-0 z-[9999] bg-yellow-400 dark:bg-yellow-600 overflow-hidden"
    style="height: {slim ? '4px' : '32px'}; transition: height 0.3s ease;"
  >
    {#if !slim}
      <p class="flex items-center justify-center gap-1.5 h-full text-sm font-medium text-yellow-900 dark:text-yellow-100">
        <span class="icon-[si--alert-duotone]" style="width: 16px; height: 16px;"></span>
        {#if !$isLoading}{$_('common.offline')}{/if}
      </p>
    {/if}
  </div>
{/if}
