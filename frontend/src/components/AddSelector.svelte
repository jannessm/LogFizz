<script lang="ts">
  let {
    close,
    select
  }: {
    close: () => void;
    select: (type: 'button' | 'target') => void;
  } = $props();
</script>

<!-- Modal Overlay -->
<div 
  class="fixed inset-0 z-50 flex items-center justify-center p-4"
  onclick={close}
  onkeydown={(e) => e.key === 'Escape' && close()}
  role="button"
  tabindex="0"
>
  <!-- Modal Content -->
  <div 
    class="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
      <h2 class="text-xl font-semibold text-gray-800">Add New</h2>
      <button
        onclick={close}
        class="text-gray-400 hover:text-gray-600 transition-colors icon-[si--close-circle-duotone]"
        style="width: 28px; height: 28px;"
        aria-label="Close"
      ></button>
    </div>

    <!-- Options -->
    <div class="p-6 space-y-3">
      <button
        onclick={() => select('button')}
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
  </div>
</div>

<style>
  /* Add backdrop blur effect */
  div[role="button"] {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
