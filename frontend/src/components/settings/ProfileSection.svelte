<script lang="ts">
  let {
    email,
    name = $bindable(),
    originalName,
    onsubmit,
    onerror
  }: {
    email: string;
    name: string;
    originalName: string;
    onsubmit: (data: { name: string }) => void;
    onerror?: (message: string) => void;
  } = $props();

  let hasNameChanged = $derived(name !== originalName);

  function handleSubmit() {
    onsubmit({ name });
  }
</script>

<div class="bg-white rounded-lg shadow-md p-6 mb-6">
  <h2 class="text-xl font-semibold text-gray-800 mb-4">Profile</h2>
  
  <div class="space-y-4">
    <div>
      <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
        Email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        disabled
        class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
      />
    </div>

    <div>
      <div class="flex items-center gap-2 mb-1">
        <label for="name" class="block text-sm font-medium text-gray-700">
          Name
        </label>
        {#if hasNameChanged}
          <span class="text-xs px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full font-medium">
            Unsaved
          </span>
        {/if}
      </div>
      <input
        id="name"
        type="text"
        bind:value={name}
        class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors {hasNameChanged ? 'border-orange-400 bg-orange-50 focus:ring-orange-500' : 'border-gray-300 focus:ring-blue-500'}"
      />
    </div>

    <button
      onclick={handleSubmit}
      disabled={!hasNameChanged}
      class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span class="w-5 h-5 icon-[si--check-line]"></span>
      Update Profile
    </button>
  </div>
</div>
