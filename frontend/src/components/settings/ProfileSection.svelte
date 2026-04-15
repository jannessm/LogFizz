<script lang="ts">
  import { _ } from '../../lib/i18n';
  import { authStore } from '../../stores/auth';
  import { snackbar } from '../../stores/snackbar';

  let {
    email,
    name = $bindable(),
    originalName,
    isOnline = true,
    onsubmit,
  }: {
    email: string;
    name: string;
    originalName: string;
    isOnline?: boolean;
    onsubmit: (data: { name: string }) => void;
  } = $props();

  let hasNameChanged = $derived(name !== originalName);
  let newEmail = $state('');
  let showEmailChange = $state(false);
  let isRequestingEmailChange = $state(false);
  let emailChangeSent = $state(false);

  function handleSubmit() {
    onsubmit({ name });
  }

  function toggleEmailChange() {
    showEmailChange = !showEmailChange;
    newEmail = '';
    emailChangeSent = false;
  }

  async function handleEmailChange() {
    if (!newEmail || isRequestingEmailChange) return;

    isRequestingEmailChange = true;
    try {
      await authStore.requestEmailChange(newEmail);
      emailChangeSent = true;
      snackbar.success($_('settings.emailChangeSent'));
    } catch (error: any) {
      if (error.response?.status === 429) {
        snackbar.error($_('auth.tooManyAttempts'));
      } else {
        snackbar.error(error.message || $_('common.error'));
      }
    } finally {
      isRequestingEmailChange = false;
    }
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
      {#if !showEmailChange}
        <button
          onclick={toggleEmailChange}
          disabled={!isOnline}
          class="text-sm text-primary hover:underline mt-1 disabled:text-gray-400 disabled:cursor-not-allowed disabled:no-underline"
        >
          {$_('settings.changeEmail')}
        </button>
      {/if}
    </div>

    {#if showEmailChange}
      <div class="p-3 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50">
        {#if emailChangeSent}
          <p class="text-sm text-green-600 dark:text-green-400">
            {$_('settings.emailChangeSentDescription')}
          </p>
          <button
            onclick={toggleEmailChange}
            class="text-sm text-primary hover:underline mt-2"
          >
            {$_('common.close')}
          </button>
        {:else}
          <label for="new-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {$_('settings.newEmail')}
          </label>
          <input
            id="new-email"
            type="email"
            bind:value={newEmail}
            disabled={!isOnline || isRequestingEmailChange}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            placeholder={$_('settings.newEmail')}
          />
          <div class="flex gap-2 mt-2">
            <button
              onclick={handleEmailChange}
              disabled={!newEmail || !isOnline || isRequestingEmailChange}
              class="flex-1 bg-primary text-white py-1.5 px-3 rounded-md hover:bg-primary-hover transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRequestingEmailChange ? $_('auth.pleaseWait') : $_('settings.sendVerification')}
            </button>
            <button
              onclick={toggleEmailChange}
              class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              {$_('common.cancel')}
            </button>
          </div>
        {/if}
      </div>
    {/if}

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
        disabled={!isOnline}
        class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed {hasNameChanged ? 'border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20 focus:ring-orange-500' : 'border-gray-300 dark:border-gray-600 focus:ring-primary'}"
      />
    </div>

    <button
      onclick={handleSubmit}
      disabled={!hasNameChanged || !isOnline}
      class="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span class="w-5 h-5 icon-[si--check-line]"></span>
      {$_('common.save')}
    </button>
  </div>
</div>
