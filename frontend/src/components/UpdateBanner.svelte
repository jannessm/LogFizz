<script lang="ts">
  import { onMount } from 'svelte';
  import { onUpdateAvailable, applyUpdate } from '../services/swUpdate';
  import { snackbar } from '../stores/snackbar';
  import { _ } from 'svelte-i18n';
  import { get } from 'svelte/store';

  let snackbarId: string | null = null;

  onMount(() => {
    const unsubscribe = onUpdateAvailable(() => {
      // Only show one update notification at a time
      if (snackbarId) return;

      const t = get(_);
      snackbarId = snackbar.withAction(
        t('sw.updateAvailable'),
        'info',
        t('sw.reload'),
        () => {
          applyUpdate();
        },
        0 // indefinite – the user must act
      );
    });

    return unsubscribe;
  });
</script>
