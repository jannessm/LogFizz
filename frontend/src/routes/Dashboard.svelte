<script lang="ts">
  import { onMount } from 'svelte';
  import { buttonsStore, sortedButtons } from '../stores/buttons';
  import { timeLogsStore } from '../stores/timelogs';
  import ButtonGrid from '../components/ButtonGrid.svelte';
  import ButtonForm from '../components/ButtonForm.svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import type { Button } from '../types';

  let showButtonForm = false;
  let editMode = false;
  let editingButton: Button | null = null;

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

  function getTodayProgress() {
    const today = new Date().toISOString().split('T')[0];
    const todayMinutes = $timeLogsStore.timeLogs
      .filter(tl => tl.end_time && tl.start_time.startsWith(today))
      .reduce((total, tl) => {
        const start = new Date(tl.start_time).getTime();
        const end = new Date(tl.end_time!).getTime();
        return total + Math.floor((end - start) / 60000);
      }, 0);
    
    const goalMinutes = $sortedButtons.reduce((sum, b) => sum + (b.goal_time_minutes || 0), 0);
    const difference = todayMinutes - goalMinutes;
    
    return { todayMinutes, goalMinutes, difference };
  }
</script>

<div class="h-screen flex flex-col bg-gray-50">
  <!-- Fixed Header -->
  <div class="flex-none bg-white border-b border-gray-200 shadow-sm">
    <div class="max-w-[500px] mx-auto px-4 py-4">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-800">Timer</h1>
        <div class="flex gap-2">
          <button
            on:click={toggleEditMode}
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
          >
            {#if editMode}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Done
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            {/if}
          </button>
          <button
            on:click={handleAddButton}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Button
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Today's Summary -->
  {#if !editMode && $sortedButtons.length > 0}
    {#each [getTodayProgress()] as progress}
      <div class="flex-none bg-blue-50 border-b border-blue-100">
        <div class="max-w-[500px] mx-auto px-4 py-3">
          <div class="flex items-center justify-between text-sm">
            <span class="font-medium text-gray-700">Today's Progress:</span>
            <div class="flex items-center gap-3">
              <span class="text-gray-600">
                {Math.floor(progress.todayMinutes / 60)}h {progress.todayMinutes % 60}m / {Math.floor(progress.goalMinutes / 60)}h {progress.goalMinutes % 60}m
              </span>
              {#if progress.goalMinutes > 0}
                <span class="font-semibold" class:text-green-600={progress.difference >= 0} class:text-red-600={progress.difference < 0}>
                  {progress.difference >= 0 ? '+' : '-'}{Math.floor(Math.abs(progress.difference) / 60)}h {Math.abs(progress.difference) % 60}m
                </span>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/each}
  {/if}

  <!-- Scrollable Button Area -->
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-[500px] mx-auto px-4 py-6">
      <ButtonGrid 
        buttons={$sortedButtons}
        {editMode}
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
