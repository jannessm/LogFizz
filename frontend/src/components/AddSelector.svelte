<script lang="ts">
  import Modal from './Modal.svelte';
  import { _ } from '../lib/i18n';

  let {
    close,
    select
  }: {
    close: () => void;
    select: (type: 'timer' | 'target') => void;
  } = $props();
</script>

<Modal title={$_('common.add')} maxWidth="max-w-sm" onclose={close}>
  {#snippet children()}
    <div class="space-y-3">
      <button
        onclick={() => select('timer')}
        class="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-primary hover:bg-primary-light dark:hover:bg-gray-700 transition-all flex items-center gap-4 group"
      >
        <div class="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 group-hover:bg-primary flex items-center justify-center transition-colors">
          <span class="icon-[si--clock-alt-duotone] text-blue-600 dark:text-blue-400 group-hover:text-white" style="width: 28px; height: 28px;"></span>
        </div>
        <div class="text-left">
          <h3 class="font-semibold text-gray-800 dark:text-gray-100 group-hover:text-primary">{$_('dashboard.addTimer')}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">{$_('dashboard.addTimerDescription')}</p>
        </div>
      </button>

      <button
        onclick={() => select('target')}
        class="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-gray-700 transition-all flex items-center gap-4 group"
      >
        <div class="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 group-hover:bg-green-500 flex items-center justify-center transition-colors">
          <span class="icon-[si--clipboard-check-alt-duotone] text-green-600 dark:text-green-400 group-hover:text-white" style="width: 28px; height: 28px;"></span>
        </div>
        <div class="text-left">
          <h3 class="font-semibold text-gray-800 dark:text-gray-100 group-hover:text-green-700 dark:group-hover:text-green-400">{$_('target.add')}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">{$_('target.addDescription')}</p>
        </div>
      </button>
    </div>
  {/snippet}
</Modal>
