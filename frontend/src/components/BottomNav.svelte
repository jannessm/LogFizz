<script lang="ts">
  import { navigate } from '../lib/navigation';

  let { currentTab = 'timer' }: {
    currentTab?: 'timer' | 'history' | 'settings';
  } = $props();

  function handleNavigate(path: string) {
    navigate(path);
  }
</script>

<nav class="w-full bg-white border-t border-gray-200 shadow-lg z-40 pb-8 pt-2">
  <div class="flex justify-center items-center h-16 w-full gap-4">
    <button 
      onclick={() => handleNavigate('/')} 
      class="flex flex-col items-center justify-center h-full transition-colors w-full max-w-[150px] {currentTab === 'timer' ? 'text-blue-600' : 'text-gray-600'}"
    >
      <span class="w-12 h-12"
        class:icon-[si--clock-alt-duotone]={currentTab === 'timer'}
        class:icon-[si--clock-alt-line]={currentTab !== 'timer'}></span>
      <span class="text-xs mt-1">Timer</span>
    </button>

    <button 
      onclick={() => handleNavigate('/history')} 
      class="flex flex-col items-center justify-center h-full transition-colors w-full max-w-[150px] {currentTab === 'history' ? 'text-blue-600' : 'text-gray-600'}"
    >
      <span class="w-12 h-12"
        class:icon-[si--bar-chart-duotone]={currentTab === 'history'}
        class:icon-[si--bar-chart-line]={currentTab !== 'history'}></span>
      <span class="text-xs mt-1">History</span>
    </button>

    <button 
      onclick={() => handleNavigate('/settings')} 
      class="flex flex-col items-center justify-center h-full transition-colors w-full max-w-[150px] {currentTab === 'settings' ? 'text-blue-600' : 'text-gray-600'}"
    >
      <span class="w-12 h-12"
        class:icon-[si--settings-alt-duotone]={currentTab === 'settings'}
        class:icon-[si--settings-alt-line]={currentTab !== 'settings'}
      ></span>
      <span class="text-xs mt-1">Settings</span>
    </button>
  </div>
</nav>
