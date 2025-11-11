<script lang="ts">
  import { onMount } from 'svelte';
  import { buttonsStore, sortedButtons } from '../stores/buttons';
  import { timeLogsStore } from '../stores/timelogs';
  import ButtonGrid from '../components/ButtonGrid.svelte';
  import ButtonForm from '../components/ButtonForm.svelte';
  import BottomNav from '../components/BottomNav.svelte';

  let showButtonForm = false;
  let editMode = false;
  let editingButton = null;

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
</script>

<div class="min-h-screen bg-gray-50 pb-16">
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800">Timer</h1>
      <div class="flex gap-2">
        <button
          on:click={toggleEditMode}
          class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          {editMode ? 'Done' : 'Edit'}
        </button>
        <button
          on:click={handleAddButton}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Button
        </button>
      </div>
    </div>

    <!-- Button Grid -->
    <ButtonGrid 
      buttons={$sortedButtons}
      {editMode}
      on:edit={handleEditButton}
    />

    <!-- Offline indicator -->
    {#if !navigator.onLine}
      <div class="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded-lg shadow-lg">
        <span class="flex items-center gap-2">
          <span class="w-2 h-2 bg-yellow-500 rounded-full"></span>
          Offline Mode
        </span>
      </div>
    {/if}
  </div>

  <!-- Bottom Navigation -->
  <BottomNav currentTab="timer" />

  <!-- Button Form Modal -->
  {#if showButtonForm}
    <ButtonForm 
      button={editingButton}
      on:close={handleCloseForm}
    />
  {/if}
</div>
