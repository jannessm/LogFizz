<script lang="ts">
  import { onMount } from 'svelte';
  import { nonArchivedTimers } from '../stores/timers';
  import { timeLogsStore } from '../stores/timelogs';
  import { authStore } from '../stores/auth';
  import { snackbar } from '../stores/snackbar';
  import { authApi } from '../services/api';
  import EditOverview from '../components/Dashboard/EditOverview.svelte';
  import TimerGraph from '../components/Dashboard/TimerGraph.svelte';

  import { TargetForm, TimelogForm, TimerForm } from '../components/forms';
  import { paymentApi, type SubscriptionStatus } from '../services/payment';
  import { navigate } from '../lib/navigation';
  import BottomNav from '../components/BottomNav.svelte';
  import AddSelector from '../components/AddSelector.svelte';
  import dayjs from 'dayjs';
  import type { Timer, TargetWithSpecs, TimeLog } from '../types';
  import { getSetting, saveSetting } from '../lib/db';
  import { saveTimelog, deleteTimelog } from '../services/formHandlers';
  import { _ } from '../lib/i18n';
  import { get } from 'svelte/store';

  let showTimerForm = $state(false);
  let showTimelogForm = $state(false);
  let showTargetForm = $state(false);
  let showEditOverview = $state(false);
  let showAddSelector = $state(false);
  let editMode = $state(false);
  let editingTimer: Timer | null = $state(null);
  let editingTimelog: TimeLog | null = $state(null);
  let editingTarget: TargetWithSpecs | null = $state(null);
  let editFromOverview = $state(false);
  let editOnStopEnabled = $state(true);
  let timerToStop: any = $state(null);
  let subscriptionStatus: SubscriptionStatus | null = $state(null);
  let paywallEnabled = $state(false);

  let timers = nonArchivedTimers;
  let user = $authStore.user;

  onMount(async () => {
    // Load edit-on-stop setting
    const formOnStop = await getSetting('editOnStop');
    editOnStopEnabled = formOnStop !== false; // default to true if not set

    // Check subscription status
    checkSubscription();
  });

  async function checkSubscription() {
    try {
      const paywallStatus = await paymentApi.getPaywallStatus();
      paywallEnabled = paywallStatus.enabled;

      if (paywallEnabled) {
        subscriptionStatus = await paymentApi.getSubscriptionStatus();
        
        // Show warning if access will expire soon (within 7 days)
        if (subscriptionStatus.status === 'trial' && subscriptionStatus.trialEndDate) {
          const daysRemaining = Math.ceil((new Date(subscriptionStatus.trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysRemaining <= 7 && daysRemaining > 0) {
            snackbar.withAction(
              `Your trial expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Subscribe to continue using TapShift.`,
              'warning',
              'Subscribe',
              () => navigate('/payment'),
              0 // Don't auto-dismiss
            );
          }
        }

        // Redirect to payment if no access
        if (!subscriptionStatus.hasAccess) {
          navigate('/payment');
        }
      }
    } catch (error: any) {
      console.error('Failed to check subscription status:', error);
    }
  }

  function handleShowAddSelector() {
    showAddSelector = true;
  }

  function handleAddSelectorClose() {
    showAddSelector = false;
  }

  function handleAddSelectorSelect(type: 'timer' | 'target') {
    showAddSelector = false;
    if (type === 'timer') {
      handleAddTimer();
    } else {
      handleAddTarget();
    }
  }

  function handleAddTimer() {
    editingTimer = null;
    showTimerForm = true;
  }

  function handleEditTimer(timer: Timer) {
    editingTimer = timer;
    showTimerForm = true;
    if (showEditOverview) {
      editFromOverview = true;
      showEditOverview = false;
    }
  }

  function handleCloseForm() {
    showTimerForm = false;
    editingTimer = null;
    
    // If we were editing a timer (not creating), reopen the edit overview
    if (editFromOverview) {
      showEditOverview = true;
    }
  }

  function handleAddTarget() {
    editingTarget = null;
    showTargetForm = true;
  }

  function handleEditTarget(target: TargetWithSpecs) {
    if (showEditOverview) {
      editFromOverview = true;
      showEditOverview = false;
    }

    editingTarget = target;
    showTargetForm = true;
    showEditOverview = false;
  }

  function handleCloseTargetForm() {
    showTargetForm = false;
    editingTarget = null;
    
    // If we were editing a target (not creating), reopen the edit overview
    if (editFromOverview) {
      showEditOverview = true;
    }
  }

  function toggleEditMode() {
    showEditOverview = !showEditOverview;
  }

  function handleCloseEditOverview() {
    showEditOverview = false;
  }

  function toggleFormOnStop() {
    editOnStopEnabled = !editOnStopEnabled;
    saveSetting('editOnStop', editOnStopEnabled);
  }

  function handleLongPress(timer: Timer, timelog: TimeLog | undefined, isActive: boolean) {
    if (isActive && timelog) {
      // Open TimelogForm to edit active timelog
      editingTimelog = timelog;
      showTimelogForm = true;
    } else {
      // Open TimerForm to edit timer
      handleEditTimer(timer);
    }
  }

  function handleCloseTimelogForm() {
    showTimelogForm = false;
    editingTimelog = null;
  }

  function handleSaveTimelog(newLog: TimeLog) {
    saveTimelog(newLog, editingTimelog, timerToStop).then(res => {
      // Close the TimelogForm after saving
      showTimelogForm = false;
      editingTimelog = null;

      if (res && res.timerToStop !== undefined) {
        timerToStop = null;
      }
    });
  }

  function handleDeleteTimelog(timelog?: TimeLog) {
    deleteTimelog(timelog);
    showTimelogForm = false;
    editingTimelog = null;
    timerToStop = null;
  }

  async function handleTimerStopped(timelog: TimeLog, timer: Timer) {
    if (editOnStopEnabled) {
      // Open TimelogForm to allow editing before stopping (optional)
      // Timer will continue running until user saves the form
      editingTimelog = {...timelog};
      timerToStop = timelog;
      showTimelogForm = true;
    } else {
      // Stop timer immediately without opening form
      await timeLogsStore.stopTimer(timelog);
    }
  }

  async function handleCloseTimelogFormWithoutSave() {
    // If there's a pending timer to stop, DON'T stop it - let it continue running
    // User cancelled the stop action by closing the form
    if (timerToStop) {
      timerToStop = null;
    }
    showTimelogForm = false;
    editingTimelog = null;
  }

</script>

<div class="h-screen flex flex-col">
  <!-- Header -->
   <div class="flex flex-col absolute top-0 left-0 right-0">
    <div class="flex mx-auto px-4 pt-4 gap-2 w-full z-20 justify-end grow-0">
      <button
        onclick={toggleFormOnStop}
        class="flex gap-2 text-gray-500 dark:text-gray-400 transition-colors"
      >
        <span class:icon-[si--toggle-off-line]={!editOnStopEnabled}
              class:icon-[si--toggle-on-duotone]={editOnStopEnabled}
              class:text-primary={editOnStopEnabled}
              class:hover:bg-primary-hover={editOnStopEnabled}
              style="width: 32px; height: 32px;"></span>
        <span class="py-1">{$_('settings.editOnStop')}</span>
      </button>
      <button
        onclick={toggleEditMode}
        class="px-4 py-2 rounded-full transition-colors icon-[si--edit-detailed-duotone]"
        class:bg-primary={showEditOverview}
        class:hover:bg-primary-hover={showEditOverview}
        class:bg-gray-400={!showEditOverview}
        class:dark:bg-gray-600={!showEditOverview}
        class:hover:bg-gray-500={!showEditOverview}
        class:dark:hover:bg-gray-500={!showEditOverview}
        class:text-white={showEditOverview}
        aria-label="Edit Overview"
        style="width: 32px; height: 32px;"
      ></button>
      <button 
        onclick={handleShowAddSelector}
        class="px-4 py-2 bg-primary rounded-full hover:bg-primary-hover transition-colors icon-[si--add-circle-duotone]"
        style="width: 32px; height: 32px;"
        aria-label="Add"
      ></button>
    </div>
   </div>

  <!-- Scrollable Button Area -->
  <div class="flex grow-1 overflow-y-auto">
    <div class="mx-auto px-4 py-6 min-w-full w-full h-full">
      <!-- Daily Targets Overview -->

      <!-- Timer Graph -->
      <TimerGraph
        buttons={$timers}
        {editMode}
        edit={handleEditTimer}
        longpress={handleLongPress}
        timerstopped={handleTimerStopped}
      />
    </div>
  </div>

  <!-- Fixed Bottom Navigation -->
  <BottomNav currentTab="timer" />

  <!-- Offline indicator -->
  {#if !navigator.onLine}
    <div class="fixed top-20 right-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 px-4 py-2 rounded-lg shadow-lg z-50 max-h-200">
      <span class="flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
        </svg>
        {$_('common.offline')}
      </span>
    </div>
  {/if}

  <!-- Edit Overview Modal -->
  {#if showEditOverview}
    <EditOverview 
      editTimer={handleEditTimer}
      editTarget={handleEditTarget}
      addTimer={handleAddTimer}
      addTarget={handleAddTarget}
      close={handleCloseEditOverview}
    />
  {/if}

  <!-- Timer Form Modal -->
  {#if showTimerForm}
    <TimerForm 
      timer={editingTimer}
      close={handleCloseForm}
    />
  {/if}

  <!-- Target Form Modal -->
  {#if showTargetForm}
    <TargetForm 
      target={editingTarget}
      close={handleCloseTargetForm}
    />
  {/if}

  <!-- Add Selector Modal -->
  {#if showAddSelector}
    <AddSelector 
      close={handleAddSelectorClose}
      select={handleAddSelectorSelect}
    />
  {/if}

  <!-- Timelog Form Modal -->
  {#if showTimelogForm && editingTimelog !== null}
    <TimelogForm
      selectedDate={dayjs()}
      existingLog={editingTimelog}
      isTimerStop={!!timerToStop}
      save={handleSaveTimelog}
      close={timerToStop ? handleCloseTimelogFormWithoutSave : handleCloseTimelogForm}
      del={handleDeleteTimelog}
    />
  {/if}
</div>
