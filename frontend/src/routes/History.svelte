<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import TimelogForm from '../components/TimelogForm.svelte';
  import HistoryCharts from '../components/HistoryCharts.svelte';
  import HistoryCalendar from '../components/HistoryCalendar.svelte';
  import HistoryLogs from '../components/HistoryLogs.svelte';
  import { timeLogsStore } from '../stores/timelogs';
  import { buttonsStore } from '../stores/buttons';
  import dayjs from 'dayjs';

  let selectedDate = dayjs();
  let currentMonth = dayjs();
  let showTimelogForm = false;
  let editingTimelog: any = null;
  let showDeleteConfirm = false;
  let deleteTarget: any = null;
  let slideDirection: 'left' | 'right' | null = null;
  let isAnimating = false;

  $: timeLogs = $timeLogsStore.timeLogs;
  $: buttons = $buttonsStore.buttons;

  onMount(async () => {
    // Load data in parallel for faster initial render
    Promise.all([
      timeLogsStore.load(),
      buttonsStore.load()
    ]);
  });

  // Get time logs for selected date and pair them into sessions
  function getSessionsForSelectedDate() {
    const dateStr = selectedDate.format('YYYY-MM-DD');
    const logs = timeLogs
      .filter(tl => tl.timestamp && tl.timestamp.startsWith(dateStr))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Pair start/stop events into sessions
    const sessions: Array<{
      button_id: string;
      startTime: string;
      endTime?: string;
      startLog: typeof logs[0];
      stopLog?: typeof logs[0];
    }> = [];
    
    const startsByButton = new Map<string, typeof logs[0]>();
    
    for (const log of logs) {
      if (log.type === 'start') {
        // New start event - save it
        startsByButton.set(log.button_id, log);
      } else if (log.type === 'stop') {
        // Stop event - pair with most recent start for this button
        const start = startsByButton.get(log.button_id);
        if (start) {
          sessions.push({
            button_id: log.button_id,
            startTime: start.timestamp,
            endTime: log.timestamp,
            startLog: start,
            stopLog: log,
          });
          startsByButton.delete(log.button_id);
        }
      }
    }
    
    // Add any remaining unpaired starts as active sessions
    for (const [button_id, start] of startsByButton.entries()) {
      sessions.push({
        button_id,
        startTime: start.timestamp,
        startLog: start,
      });
    }
    
    return sessions.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  $: selectedDateSessions = getSessionsForSelectedDate();

  async function previousMonth() {
    if (isAnimating) return;
    isAnimating = true;
    slideDirection = 'right';
    setTimeout(() => {
      currentMonth = currentMonth.subtract(1, 'month');
      slideDirection = null;
      isAnimating = false;
    }, 300);
  }

  async function nextMonth() {
    if (isAnimating) return;
    isAnimating = true;
    slideDirection = 'left';
    setTimeout(() => {
      currentMonth = currentMonth.add(1, 'month');
      slideDirection = null;
      isAnimating = false;
    }, 300);
  }

  function selectDate(date: dayjs.Dayjs) {
    selectedDate = date;
  }

  function handleAddTimelog() {
    editingTimelog = null;
    showTimelogForm = true;
  }

  function handleEditTimelog(session: any) {
    editingTimelog = session;
    showTimelogForm = true;
  }

  async function handleSaveTimelog(event: CustomEvent) {
    const { button_id, startTimestamp, endTimestamp, existingLog } = event.detail;
    
    // For now, just add new entries
    // In a full implementation, you'd call the API to create/update timelogs
    await timeLogsStore.create(button_id, startTimestamp, 'start');
    if (endTimestamp) {
      await timeLogsStore.create(button_id, endTimestamp, 'stop');
    }
    
    showTimelogForm = false;
    editingTimelog = null;
  }

  function handleCloseForm() {
    showTimelogForm = false;
    editingTimelog = null;
  }

  function confirmDelete(session: any) {
    deleteTarget = session;
    showDeleteConfirm = true;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    
    // Delete the timelog entries
    if (deleteTarget.startLog?.id) {
      await timeLogsStore.delete(deleteTarget.startLog.id);
    }
    if (deleteTarget.stopLog?.id) {
      await timeLogsStore.delete(deleteTarget.stopLog.id);
    }
    
    // Force update of sessions after deletion
    selectedDateSessions = getSessionsForSelectedDate();
    
    showDeleteConfirm = false;
    deleteTarget = null;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
    deleteTarget = null;
  }
</script>

<div class="min-h-screen bg-gray-50 pb-16">
  <div class="max-w-[500px] mx-auto px-4 py-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800">History</h1>
      <div class="flex items-center gap-2">
        <button
          on:click={previousMonth}
          class="p-2 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 icon-[si--chevron-left-alt-duotone]"
          aria-label="Previous month"
          disabled={isAnimating}
        ></button>
        <span class="font-semibold text-lg min-w-[150px] text-center text-gray-800">
          {currentMonth.format('MMMM YYYY')}
        </span>
        <button
          on:click={nextMonth}
          class="p-2 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 icon-[si--chevron-right-alt-duotone]"
          aria-label="Next month"
          disabled={isAnimating}
        ></button>
      </div>
    </div>

    <!-- Charts Component -->
    <HistoryCharts
      {buttons}
      {timeLogs}
      {currentMonth}
    />

    <!-- Calendar Component -->
    <HistoryCalendar
      {currentMonth}
      {selectedDate}
      {buttons}
      {timeLogs}
      {slideDirection}
      onSelectDate={selectDate}
    />

    <!-- Logs Component with Filter -->
    <HistoryLogs
      {selectedDate}
      sessions={selectedDateSessions}
      {buttons}
      onAddTimelog={handleAddTimelog}
      onEditTimelog={handleEditTimelog}
      onDeleteTimelog={confirmDelete}
    />
  </div>

  <BottomNav currentTab="history" />

  <!-- Timelog Form Modal -->
  {#if showTimelogForm}
    <TimelogForm
      {selectedDate}
      existingLog={editingTimelog}
      on:save={handleSaveTimelog}
      on:close={handleCloseForm}
    />
  {/if}

  <!-- Delete Confirmation Modal -->
  {#if showDeleteConfirm}
    <div 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="button"
      tabindex="-1"
      aria-label="Close dialog"
      on:click={cancelDelete}
      on:keydown={(e) => e.key === 'Escape' && cancelDelete()}
    >
      <div 
        class="bg-white rounded-lg shadow-xl w-full max-w-[400px] mx-4 p-6"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        on:click|stopPropagation
        on:keydown={() => {}}
      >
        <h3 class="text-lg font-bold text-gray-800 mb-2">Delete Time Entry?</h3>
        <p class="text-gray-600 mb-6">This action cannot be undone.</p>
        <div class="flex gap-3">
          <button
            on:click={cancelDelete}
            class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            on:click={handleDelete}
            class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
