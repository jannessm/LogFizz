<script lang="ts">
  import Modal from './Modal.svelte';

  let {
    close,
    select
  }: {
    close: () => void;
    select: (type: 'timer' | 'target') => void;
  } = $props();
</script>

<Modal title="Add New" maxWidth="max-w-sm" onclose={close}>
  {#snippet children()}
    <div class="space-y-3">
      <button
        onclick={() => select('timer')}
        class="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center gap-4 group"
      >
        <div class="w-12 h-12 rounded-full bg-blue-100 group-hover:bg-blue-500 flex items-center justify-center transition-colors">
          <span class="icon-[si--clock-alt-duotone] text-blue-600 group-hover:text-white" style="width: 28px; height: 28px;"></span>
        </div>
        <div class="text-left">
          <h3 class="font-semibold text-gray-800 group-hover:text-blue-700">Add Timer</h3>
          <p class="text-sm text-gray-600">Create a new timer button</p>
        </div>
      </button>

      <button
        onclick={() => select('target')}
        class="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all flex items-center gap-4 group"
      >
        <div class="w-12 h-12 rounded-full bg-green-100 group-hover:bg-green-500 flex items-center justify-center transition-colors">
          <span class="icon-[si--clipboard-check-alt-duotone] text-green-600 group-hover:text-white" style="width: 28px; height: 28px;"></span>
        </div>
        <div class="text-left">
          <h3 class="font-semibold text-gray-800 group-hover:text-green-700">Add Target</h3>
          <p class="text-sm text-gray-600">Create a new target</p>
        </div>
      </button>
    </div>
  {/snippet}
</Modal>
