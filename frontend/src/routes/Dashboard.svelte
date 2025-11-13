<script lang="ts">
  import { onMount } from 'svelte';
  import { buttonsStore, sortedButtons } from '../stores/buttons';
  import { timeLogsStore } from '../stores/timelogs';
  import ButtonGraph from '../components/ButtonGraph.svelte';
  import ButtonForm from '../components/ButtonForm.svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import type { Button } from '../types';

  let showButtonForm = false;
  let editMode = false;
  let editingButton: Button | null = null;
  let toggleMode = true;

  onMount(async () => {
    await buttonsStore.load();
    await timeLogsStore.load();
    await timeLogsStore.loadActive();
  });

  function handleAddButton() {
    editingButton = null;
    showButtonForm = true;
  }

  function handleEditButton(event: CustomEvent) {
    editingButton = event.detail;
    showButtonForm = true;
  }

  function handleCloseForm() {
    showButtonForm = false;
    editingButton = null;
  }

  function toggleEditMode() {
    editMode = !editMode;
  }

  function toggleToggleMode() {
    toggleMode = !toggleMode;
  }

</script>

<div class="h-screen flex flex-col bg-gray-50">
  <!-- Header -->
  <div class="flex mx-auto px-4 py-4 gap-2 absolute top-0 right-0 z-10">
    <button
      on:click={toggleToggleMode}
      class="flex gap-2 text-gray-500 transition-colors"
    >
      <span class:icon-[si--toggle-off-line]={!toggleMode}
            class:icon-[si--toggle-on-duotone]={toggleMode}
            class:text-blue-400={toggleMode}
            class:hover:bg-blue-500={toggleMode}
            style="width: 32px; height: 32px;"></span>
      <span class="py-1">Auto Stop</span>
    </button>
    <button
      on:click={toggleEditMode}
      class="px-4 py-2 bg-gray-400 rounded-full hover:bg-blue-500 transition-colors"
      class:icon-[si--check-circle-line]={editMode}
      class:icon-[si--edit-detailed-duotone]={!editMode}
      aria-label="Edit Mode"
      style="width: 32px; height: 32px;"
    ></button>
    <button 
      on:click={handleAddButton}
      class="px-4 py-2 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors icon-[si--add-circle-duotone]"
      style="width: 32px; height: 32px;"
      aria-label="Add Button"
    ></button>
  </div>

  <!-- Scrollable Button Area -->
  <div class="flex overflow-y-auto">
    <div class="mx-auto px-4 py-6 min-w-full w-full">
      <ButtonGraph 
        buttons={$sortedButtons}
        {editMode}
        {toggleMode}
        on:edit={handleEditButton}
      />
    </div>
  </div>

  <!-- Fixed Bottom Navigation -->
  <BottomNav currentTab="timer" />

  <!-- Offline indicator -->
  {#if !navigator.onLine}
    <div class="fixed top-20 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded-lg shadow-lg z-50 max-h-200">
      <span class="flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
        </svg>
        Offline Mode
      </span>
    </div>
  {/if}

  <!-- Button Form Modal -->
  {#if showButtonForm}
    <ButtonForm 
      button={editingButton}
      on:close={handleCloseForm}
    />
  {/if}
</div>
