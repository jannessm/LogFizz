<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';

  async function handlePasswordChange() {
    if (newPassword !== confirmPassword) {
      dispatch('error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      dispatch('error', 'Password must be at least 8 characters');
      return;
    }

    dispatch('submit', { currentPassword, newPassword });
    
    // Clear fields after submission (parent will handle success/error)
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
  }
</script>

<div class="bg-white rounded-lg shadow-md p-6 mb-6">
  <h2 class="text-xl font-semibold text-gray-800 mb-4">Change Password</h2>
  
  <div class="space-y-4">
    <div>
      <label for="currentPassword" class="block text-sm font-medium text-gray-700 mb-1">
        Current Password
      </label>
      <input
        id="currentPassword"
        type="password"
        bind:value={currentPassword}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label for="newPassword" class="block text-sm font-medium text-gray-700 mb-1">
        New Password
      </label>
      <input
        id="newPassword"
        type="password"
        bind:value={newPassword}
        minlength="8"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">
        Confirm New Password
      </label>
      <input
        id="confirmPassword"
        type="password"
        bind:value={confirmPassword}
        minlength="8"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <button
      on:click={handlePasswordChange}
      class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
    >
      <span class="w-5 h-5 icon-[si--key-line]"></span>
      Change Password
    </button>
  </div>
</div>
