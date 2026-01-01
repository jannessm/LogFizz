<script lang="ts">
  import { onMount } from 'svelte';
  import { buttonsStore } from '../stores/buttons';
  import { timeLogsStore } from '../stores/timelogs';
  import { targetsStore } from '../stores/targets';
  import { authStore } from '../stores/auth';
  import { snackbar } from '../stores/snackbar';
  import { authApi } from '../services/api';
  import { paymentApi, type SubscriptionStatus } from '../services/payment';
  import { navigate } from '../lib/navigation';
  import ButtonGraph from '../components/ButtonGraph.svelte';
  import ButtonForm from '../components/ButtonForm.svelte';
  import TimelogForm from '../components/TimelogForm.svelte';
  import DailyTargets from '../components/DailyTargets.svelte';
  import TargetForm from '../components/TargetForm.svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import EditOverview from '../components/EditOverview.svelte';
  import AddSelector from '../components/AddSelector.svelte';
  import dayjs from 'dayjs';
  import type { Button, DailyTarget } from '../types';
  import { getSetting } from '../lib/db';

  let showButtonForm = false;
  let showTimelogForm = false;
  let showTargetForm = false;
  let showEditOverview = false;
  let showAddSelector = false;
  let editMode = false;
  let editingButton: Button | null = null;
  let editingTimelog: any = null;
  let editingTarget: DailyTarget | null = null;
  let toggleMode = true;
  let verificationReminderShown = false;
  let editOnStopEnabled = true;
  let timerToStop: any = null;
  let subscriptionStatus: SubscriptionStatus | null = null;
  let paywallEnabled = false;

  $: user = $authStore.user;

  onMount(async () => {
    
    await Promise.all([
      buttonsStore.load(),
      targetsStore.load(),
    ]);

    await Promise.all([
      timeLogsStore.load(),
      timeLogsStore.loadActive(),
    ]);

    // Load edit-on-stop setting
    const setting = await getSetting('editOnStop');
    editOnStopEnabled = setting !== false; // default to true if not set

    // Check if email is verified and show reminder
    checkEmailVerification();

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

  function checkEmailVerification() {
    if (!user || verificationReminderShown) return;

    // Check if email is not verified (email_verified_at is null or undefined)
    if (!user.email_verified_at) {
      verificationReminderShown = true;
      
      snackbar.withAction(
        'Please verify your email address to ensure account security',
        'warning',
        'Resend Email',
        async () => {
          try {
            await authApi.resendVerification(user.email);
            snackbar.success('Verification email sent! Please check your inbox.', 6000);
          } catch (error: any) {
            snackbar.error('Failed to send verification email. Please try again later.', 5000);
          }
        },
        0 // Don't auto-dismiss
      );
    }
  }

  // Watch for user changes to re-check verification status
  $: if (user && !verificationReminderShown) {
    checkEmailVerification();
  }

  function handleShowAddSelector() {
    showAddSelector = true;
  }

  function handleAddSelectorClose() {
    showAddSelector = false;
  }

  function handleAddSelectorSelect(event: CustomEvent<{ type: 'button' | 'target' }>) {
    showAddSelector = false;
    if (event.detail.type === 'button') {
      handleAddButton();
    } else {
      handleAddTarget();
    }
  }

  function handleAddButton() {
    editingButton = null;
    showButtonForm = true;
  }

  function handleEditButton(event: CustomEvent | Button) {
    const button = 'detail' in event ? event.detail : event;
    editingButton = button;
    showButtonForm = true;
    showEditOverview = false;
  }

  function handleCloseForm() {
    showButtonForm = false;
    editingButton = null;
  }

  function handleAddTarget() {
    editingTarget = null;
    showTargetForm = true;
  }

  function handleEditTarget(target: DailyTarget) {
    editingTarget = target;
    showTargetForm = true;
    showEditOverview = false;
  }

  function handleCloseTargetForm() {
    showTargetForm = false;
    editingTarget = null;
  }

  function toggleEditMode() {
    showEditOverview = !showEditOverview;
  }

  function handleCloseEditOverview() {
    showEditOverview = false;
  }

  function toggleToggleMode() {
    toggleMode = !toggleMode;
  }

  function handleLongPress(event: CustomEvent<{ button: Button; isActive: boolean }>) {
    const { button, isActive } = event.detail;
    
    if (isActive) {
      // Find the active timelog for this button
      const activeTimer = $timeLogsStore.activeTimers.find(t => t.button_id === button.id);
      if (activeTimer) {
        // Open TimelogForm to edit active timelog
        editingTimelog = {
          button_id: button.id,
          startTime: activeTimer.start_timestamp,
          endTime: null,
          log: activeTimer
        };
        showTimelogForm = true;
      }
    } else {
      // Open ButtonForm to edit button
      handleEditButton(button);
    }
  }

  function handleCloseTimelogForm() {
    showTimelogForm = false;
    editingTimelog = null;
  }

  async function handleSaveTimelog(event: CustomEvent) {
    const { button_id, startTimestamp, endTimestamp, notes, existingLog } = event.detail;
    
    // If this is a timer being stopped (timerToStop is set), stop it with the notes and custom end time
    if (timerToStop && existingLog?.log?.id === timerToStop.id) {
      await timeLogsStore.stopTimer(timerToStop.id, notes || undefined, endTimestamp || undefined);
      timerToStop = null;
    } else if (existingLog && existingLog.log) {
      // Editing existing timelog
      await timeLogsStore.update(existingLog.log.id, {
        button_id,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp || undefined,
        notes: notes || undefined,
      });
    } else {
      // Creating new timelog
      await timeLogsStore.create({
        button_id,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp || undefined,
        notes: notes || undefined,
      });
    }
    
    showTimelogForm = false;
    editingTimelog = null;
  }

  function handleDeleteTimelog(event: CustomEvent) {
    const { session } = event.detail;
    if (session?.log?.id) {
      timeLogsStore.delete(session.log.id);
    }
    showTimelogForm = false;
    editingTimelog = null;
  }

  async function handleTimerStopped(event: CustomEvent) {
    const { timer, button } = event.detail;
    timerToStop = timer;

    if (editOnStopEnabled) {
      // Open TimelogForm to allow adding notes before stopping
      editingTimelog = {
        button_id: button.id,
        startTime: timer.start_timestamp,
        endTime: null,
        log: timer
      };
      showTimelogForm = true;
    } else {
      // Stop timer immediately without opening form
      await timeLogsStore.stopTimer(timer.id);
      timerToStop = null;
    }
  }

  async function handleCloseTimelogFormWithStop() {
    // If there's a pending timer to stop, stop it now without saving changes
    if (timerToStop) {
      await timeLogsStore.stopTimer(timerToStop.id);
      timerToStop = null;
    }
    showTimelogForm = false;
    editingTimelog = null;
  }

</script>

<div class="h-screen flex flex-col bg-gray-50">
  <!-- Header -->
   <div class="flex flex-col absolute top-0 left-0 right-0">
    <div class="flex mx-auto px-4 pt-4 gap-2 w-full z-20 justify-end grow-0">
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
        class="px-4 py-2 rounded-full transition-colors icon-[si--edit-detailed-duotone]"
        class:bg-blue-600={showEditOverview}
        class:hover:bg-blue-700={showEditOverview}
        class:bg-gray-400={!showEditOverview}
        class:hover:bg-gray-500={!showEditOverview}
        class:text-white={showEditOverview}
        aria-label="Edit Overview"
        style="width: 32px; height: 32px;"
      ></button>
      <button 
        on:click={handleShowAddSelector}
        class="px-4 py-2 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors icon-[si--add-circle-duotone]"
        style="width: 32px; height: 32px;"
        aria-label="Add"
      ></button>
    </div>
    <DailyTargets />
   </div>

  <!-- Scrollable Button Area -->
  <div class="flex grow-1 overflow-y-auto">
    <div class="mx-auto px-4 py-6 min-w-full w-full h-full">
      <!-- Daily Targets Overview -->

      <!-- Button Graph -->
      <ButtonGraph 
        buttons={$buttonsStore.buttons.filter(b => !b.archived)}
        {editMode}
        {toggleMode}
        on:edit={handleEditButton}
        on:longpress={handleLongPress}
        on:timerstopped={handleTimerStopped}
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

  <!-- Edit Overview Modal -->
  {#if showEditOverview}
    <EditOverview 
      onEditButton={handleEditButton}
      onEditTarget={handleEditTarget}
      onAddButton={handleAddButton}
      onAddTarget={handleAddTarget}
      on:close={handleCloseEditOverview}
    />
  {/if}

  <!-- Button Form Modal -->
  {#if showButtonForm}
    <ButtonForm 
      button={editingButton}
      on:close={handleCloseForm}
    />
  {/if}

  <!-- Target Form Modal -->
  {#if showTargetForm}
    <TargetForm 
      target={editingTarget}
      on:close={handleCloseTargetForm}
    />
  {/if}

  <!-- Add Selector Modal -->
  {#if showAddSelector}
    <AddSelector 
      on:close={handleAddSelectorClose}
      on:select={handleAddSelectorSelect}
    />
  {/if}

  <!-- Timelog Form Modal -->
  {#if showTimelogForm}
    <TimelogForm
      selectedDate={dayjs()}
      existingLog={editingTimelog}
      isTimerStop={!!timerToStop}
      on:save={handleSaveTimelog}
      on:close={timerToStop ? handleCloseTimelogFormWithStop : handleCloseTimelogForm}
      on:delete={handleDeleteTimelog}
    />
  {/if}
</div>
