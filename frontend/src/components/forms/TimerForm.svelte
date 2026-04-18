<script lang="ts">
  import type { Timer } from '../../types';
  import { timersStore } from '../../stores/timers';
  import { targets } from '../../stores/targets';
  import EmojiPicker from './EmojiPicker.svelte';
  import { _ } from '../../lib/i18n';

  let {
    timer = null,
    close
  }: {
    timer?: Timer | null;
    close: () => void;
  } = $props();

  const errMessages = {
    timerNameRequired: $_('timer.nameRequired'),
    targetRequired: $_('timer.targetRequired'),
    saveFailed: $_('timer.saveFailed'),
    deleteFailed: $_('timer.deleteFailed'),
  };

  let name = $state(timer?.name || '');
  let emoji = $state(timer?.emoji || '');
  let color = $state(timer?.color || '#3B82F6');
  let autoSubtractBreaks = $state(timer?.auto_subtract_breaks ?? false);
  let archived = $state(timer?.archived ?? false);
  let targetId = $state(timer?.target_id || '');
  let isLoading = $state(false);
  let errorMessage = $state('');
  let showDeleteConfirm = $state(false);

  const colorPresets = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
  ];

  async function handleSubmit() {
    if (!name.trim()) {
      errorMessage = errMessages.timerNameRequired;
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      const timerData = {
        name: name.trim(),
        emoji: emoji || undefined,
        color,
        auto_subtract_breaks: autoSubtractBreaks,
        archived,
        target_id: targetId || null,
      };

      if (timer) {
        await timersStore.update(timer.id, timerData);
      } else {
        await timersStore.create(timerData);
      }

      close();
    } catch (error: any) {
      errorMessage = error.message || errMessages.saveFailed;
    } finally {
      isLoading = false;
    }
  }

  function handleDeleteClick() {
    showDeleteConfirm = true;
  }

  async function handleDeleteConfirm() {
    if (!timer) return;
    
    isLoading = true;
    try {
      await timersStore.delete($state.snapshot(timer));
      showDeleteConfirm = false;
      close();
    } catch (error: any) {
      errorMessage = error.message || errMessages.deleteFailed;
      showDeleteConfirm = false;
    } finally {
      isLoading = false;
    }
  }

  function handleDeleteCancel() {
    showDeleteConfirm = false;
  }
</script>

<div 
  class="fixed inset-0 z-50 flex items-center justify-center p-4" 
  onclick={close}
  onkeydown={(e) => e.key === 'Escape' && close()}
  role="button"
  tabindex="0"
>
  <div 
    class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
      <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{timer ? $_('timerform.edit') : $_('timerform.add')}</h2>
      <button
        onclick={close}
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors icon-[si--close-circle-duotone]"
        style="width: 28px; height: 28px;"
        aria-label={$_('common.close')}
      ></button>
    </div>

    <!-- Content -->
    <div class="overflow-y-auto flex-1 p-6">
      {#if errorMessage}
        <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded">
          {errorMessage}
        </div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">

        <!-- Emoji -->
        <div>
          <EmojiPicker 
            value={emoji} 
            select={(e) => emoji = e}
            clear={() => emoji = ''}
          />
        </div>

        <!-- Name -->
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {$_('timer.timerName')}
          </label>
          <input
            id="name"
            type="text"
            bind:value={name}
            required
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={$_('timer.placeholderTimerName')}
          />
        </div>

        <!-- Color -->
        <div>
          <label for="colorPicker" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {$_('timer.color')}
          </label>
          <div class="flex gap-2 flex-wrap mb-2">
            {#each colorPresets as preset}
              <button
                type="button"
                onclick={() => color = preset}
                class="w-10 h-10 rounded-lg border-2 transition-all"
                class:border-gray-800={color === preset}
                class:dark:border-white={color === preset}
                class:border-gray-300={color !== preset}
                class:dark:border-gray-600={color !== preset}
                style="background-color: {preset}"
                aria-label="Select color {preset}"
              ></button>
            {/each}
          </div>
          <input
            id="colorPicker"
            type="color"
            bind:value={color}
            class="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600"
          />
        </div>

        <!-- Target Selection -->
        <div>
          <label for="target" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {$_('timer.target')}
          </label>
          <select
            id="target"
            bind:value={targetId}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{$_('timer.selectTarget')}</option>
            {#each $targets as target}
              <option value={target.id}>{target.name}</option>
            {/each}
          </select>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {$_('timer.targetDescription')}
          </div>
        </div>

        <!-- Auto subtract breaks -->
        <div class="flex items-center">
          <input
            id="autoBreaks"
            type="checkbox"
            bind:checked={autoSubtractBreaks}
            class="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
          />
          <label for="autoBreaks" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
            {$_('timer.automaticallySubtractBreaks')}
          </label>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 pl-6">
          <p>{$_('timer.breakRules6to9')}</p>
          <p>{$_('timer.breakRules9plus')}</p>
        </div>

        <!-- Archived -->
        <div class="flex items-center">
          <input
            id="archived"
            type="checkbox"
            bind:checked={archived}
            class="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
          />
          <label for="archived" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
            {$_('timer.archiveTimer')}
          </label>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 pl-6">
          <p>{$_('timer.archivedTimersHidden')}</p>
        </div>

        <!-- Actions -->
        <div class="flex gap-3 pt-4">
          <button
            type="button"
            onclick={close}
            class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {$_('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isLoading}
            class="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? $_('common.saving') : $_('common.save')}
          </button>
        </div>
        
        <!-- Delete Button (only shown when editing) -->
        {#if timer}
          <button
            type="button"
            onclick={handleDeleteClick}
            class="w-full px-4 py-2 border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 dark:hover:border-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <span class="icon-[si--bin-duotone]" style="width: 20px; height: 20px;"></span>
            {$_('timer.deleteTimer')}
          </button>
        {/if}
      </form>
    </div>
  </div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
  <div 
    class="fixed inset-0 z-[60] flex items-center justify-center p-4"
    onclick={handleDeleteCancel}
    onkeydown={(e) => e.key === 'Escape' && handleDeleteCancel()}
    role="button"
    tabindex="0"
  >
    <!-- Modal Content -->
    <div 
      class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-[400px] overflow-hidden flex flex-col"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div class="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
        <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{$_('timer.deleteTimer')}</h3>
        <button
          onclick={handleDeleteCancel}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors icon-[si--close-circle-duotone]"
          style="width: 28px; height: 28px;"
          aria-label={$_('common.close')}
        ></button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">
        <p class="text-gray-600 dark:text-gray-400">
          {$_('timer.deleteConfirmation')} "{timer?.name}"?
        </p>
        <div class="flex gap-3">
          <button
            onclick={handleDeleteCancel}
            class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {$_('common.cancel')}
          </button>
          <button
            onclick={handleDeleteConfirm}
            class="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            {$_('common.delete')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Add backdrop blur effect */
  div[role="button"] {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
