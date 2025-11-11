<script lang="ts">
  import { Link } from 'svelte-routing';

  export let currentTab: 'timer' | 'history' | 'settings' = 'timer';
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
  <div class="flex justify-around items-center h-16">
    <Link to="/">
      <div class="flex-1 flex flex-col items-center justify-center h-full transition-colors {currentTab === 'timer' ? 'text-blue-600' : 'text-gray-600'}">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="text-xs mt-1">Timer</span>
      </div>
    </Link>

    <Link to="/history">
      <div class="flex-1 flex flex-col items-center justify-center h-full transition-colors {currentTab === 'history' ? 'text-blue-600' : 'text-gray-600'}">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
        <span class="text-xs mt-1">History</span>
      </div>
    </Link>

    <Link to="/settings">
      <div class="flex-1 flex flex-col items-center justify-center h-full transition-colors {currentTab === 'settings' ? 'text-blue-600' : 'text-gray-600'}">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
        <span class="text-xs mt-1">Settings</span>
      </div>
    </Link>
  </div>
</nav>
