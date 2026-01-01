<script lang="ts">
  import { onMount } from 'svelte';
  import { nonArchivedTimers } from '../stores/timers';
  import { timeLogsStore, activeTimeLogs } from '../stores/timelogs';
  import { authStore } from '../stores/auth';
  import { snackbar } from '../stores/snackbar';
  import { authApi } from '../services/api';
  import { EditOverview, TimerGraph } from '../components/dashboard';

  import { TargetForm, TimelogForm, TimerForm } from '../components/forms';
  import DailyTargets from '../components/DailyTargets.svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import AddSelector from '../components/AddSelector.svelte';
  import dayjs from 'dayjs';
  import type { Timer, TargetWithSpecs, TimeLog } from '../types';
  import { getSetting } from '../lib/db';

  let showTimerForm = false;
  let showTimelogForm = false;
  let showTargetForm = false;
  let showEditOverview = false;
  let showAddSelector = false;
  let editMode = false;
  let editingTimer: Timer | null = null;
  let editingTimelog: any = null;
  let editingTarget: TargetWithSpecs | null = null;
  let toggleMode = true;
  let verificationReminderShown = false;
  let editOnStopEnabled = true;
  let timerToStop: any = null;

  $: timers = nonArchivedTimers;
  $: user = $authStore.user;

  onMount(async () => {
    // Load edit-on-stop setting
    const setting = await getSetting('editOnStop');
    editOnStopEnabled = setting !== false; // default to true if not set

    // Check if email is verified and show reminder
    checkEmailVerification();
  });

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
            // Check for rate limiting (429 Too Many Requests)
            if (error.response?.status === 429) {
              snackbar.error('Too many verification requests. Please wait 15 minutes before trying again.', 8000);
            } else {
              snackbar.error('Failed to send verification email. Please try again later.', 5000);
            }
          }
        },
        10000 // 10s
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
    console.log('Editing timer:', timer, editMode);
    editingTimer = timer;
    showTimerForm = true;
    showEditOverview = false;
  }

  function handleCloseForm() {
    showTimerForm = false;
    editingTimer = null;
  }

  function handleAddTarget() {
    editingTarget = null;
    showTargetForm = true;
  }

  function handleEditTarget(target: TargetWithSpecs) {
    editingTarget = target;
    showTargetForm = true;
    showEditOverview = false;
  }

  function handleCloseTargetForm() {
    const wasEditingFromOverview = editingTarget !== null;
    showTargetForm = false;
    editingTarget = null;
    
    // If we were editing a target (not creating), reopen the edit overview
    if (wasEditingFromOverview) {
      showEditOverview = true;
    }
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

  function handleLongPress(timer: Timer, isActive: boolean) {
    if (isActive) {
      // Find the active timelog for this timer
      const activeTimer = $activeTimeLogs?.find(t => t.timer_id === timer.id);
      if (activeTimer) {
        // Open TimelogForm to edit active timelog
        editingTimelog = {
          timer_id: timer.id,
          startTime: activeTimer.start_timestamp,
          endTime: null,
          log: activeTimer
        };
        showTimelogForm = true;
      }
    } else {
      // Open TimerForm to edit timer
      handleEditTimer(timer);
    }
  }

  function handleCloseTimelogForm() {
    showTimelogForm = false;
    editingTimelog = null;
  }

  async function handleSaveTimelog(data: {
    timer_id: string;
    type: 'normal' | 'sick' | 'holiday' | 'business-trip' | 'child-sick';
    startTimestamp: string;
    endTimestamp?: string | null;
    notes?: string;
    existingLog?: { log: TimeLog };
  }) {
    const { timer_id, type, startTimestamp, endTimestamp, notes, existingLog } = data;

    // If this is a timer being stopped (timerToStop is set), stop it with the notes and custom end time
    if (timerToStop) {
      await timeLogsStore.stopTimer(timerToStop, notes || undefined, endTimestamp || undefined);
      timerToStop = null;
    } else if (existingLog && existingLog.log) {
      // Editing existing timelog
      await timeLogsStore.update(existingLog.log.id, {
        timer_id,
        type,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp || undefined,
        notes: notes || undefined,
      });
    } else {
      // Creating new timelog
      await timeLogsStore.create({
        timer_id,
        type,
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
    if (session?.log) {
      timeLogsStore.delete(session.log);
    }
    showTimelogForm = false;
    editingTimelog = null;
    timerToStop = null;
  }

  async function handleTimerStopped(timelog: TimeLog, timer: Timer) {
    if (editOnStopEnabled) {
      // Open TimelogForm to allow editing before stopping (optional)
      // Timer will continue running until user saves the form
      editingTimelog = {
        timer_id: timer.id,
        startTime: timelog.start_timestamp,
        endTime: null,
        log: timelog, // Pass the actual timelog, not timer
        pendingStop: true // Flag to indicate this is a pending stop
      };
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
      console.log('Timer stop cancelled - timer continues running');
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

      <!-- Timer Graph -->
      <TimerGraph
        buttons={$timers}
        {editMode}
        {toggleMode}
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
  {#if showTimelogForm}
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
