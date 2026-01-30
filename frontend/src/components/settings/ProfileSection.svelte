<script lang="ts">
  import { _ } from '../../lib/i18n';

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

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
  <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">{$_('settings.profile')}</h2>
  
  <div class="space-y-4">
    <div>
      <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {$_('auth.email')}
      </label>
      <input
        id="email"
        type="email"
        value={email}
        disabled
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      />
    </div>

    <div>
      <div class="flex items-center gap-2 mb-1">
        <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {$_('auth.name')}
        </label>
        {#if hasNameChanged}
          <span class="text-xs px-2 py-0.5 bg-orange-200 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-full font-medium">
            {$_('common.unsaved')}
          </span>
        {/if}
      </div>
      <input
        id="name"
        type="text"
        bind:value={name}
        class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 {hasNameChanged ? 'border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20 focus:ring-orange-500' : 'border-gray-300 dark:border-gray-600 focus:ring-primary'}"
      />
    </div>

    <button
      onclick={handleSubmit}
      disabled={!hasNameChanged}
      class="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span class="w-5 h-5 icon-[si--check-line]"></span>
      {$_('common.save')}
    </button>
  </div>
</div>
