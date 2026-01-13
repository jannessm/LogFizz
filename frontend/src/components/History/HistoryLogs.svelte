<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import SessionBox from './SessionBox.svelte';
  import TimelogForm from '../forms/TimelogForm.svelte';
  import { timeLogsStore } from '../../stores/timelogs';
  import type { Holiday, Timer, TimeLog, TimeLogType } from '../../../../lib/types';
  import { dayjs } from '../../types';
  import { computeIndentation, type Session } from '../../lib/utils/computeIndentation';
  import {
    calculateTimeline, getHourLabels, getSessionsForSelectedDate,
    type SessionData, type TimelineProps
  } from '../../services/timeline';
    import { saveTimelog } from '../../services/formHandlers';

  // Get user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let { 
    selectedDate, 
    timeLogs, 
    timers, 
    relevantHolidays = []
  }: {
    selectedDate: dayjs.Dayjs;
    timeLogs: TimeLog[];
    timers: Timer[];
    relevantHolidays: Holiday[]; // Holidays that affect balance calculations for this date
  } = $props();

  // Internal state for timelog management
  let showTimelogForm = $state(false);
  let editingTimelog: Session | null = $state(null);

  let sessionsData: SessionData = $derived(getSessionsForSelectedDate(selectedDate, timeLogs));
  let sessions: Session[] = $derived(sessionsData.sessions);
  let multiDaySessions: Session[] = $derived(sessionsData.multiDaySessions);
  let selectedTimerFilter: string | null = $state(null);

  let timelineProps: TimelineProps = $derived(calculateTimeline(sessions, selectedDate));
  let timelineStart: dayjs.Dayjs | null = $derived(timelineProps.timelineStart);
  let timelineEnd: dayjs.Dayjs | null = $derived(timelineProps.timelineEnd);
  let timelineHours: number = $derived(timelineProps.timelineHours);
  let timelineHeight: number = $derived(timelineProps.timelineHeight);
  let refreshTick = $state(0); // Used to trigger reactivity for running sessions
  let intervalId: number | undefined;
  let hourLabels: string[] = $derived(getHourLabels(timelineStart, timelineHours));

  // Derive unique timers
  let uniqueTimers = $derived(
    Array.from(new Set(sessions.map(s => s.timer_id)))
      .map(id => timers.find(t => t.id === id))
      .filter(t => t !== undefined)
  );

  // Apply timer filter
  let filteredSessions = $derived(
    selectedTimerFilter 
      ? sessions.filter(s => s.timer_id === selectedTimerFilter)
      : sessions
  );
  let filteredMultiDaySessions = $derived(
    selectedTimerFilter 
      ? multiDaySessions.filter(s => s.timer_id === selectedTimerFilter)
      : multiDaySessions
  );

  let displaySessions: Session[] = $derived(computeIndentation(filteredSessions));

  const TYPE_LABELS: Record<string, string> = {
    'sick': 'Sick Leave',
    'holiday': 'Holiday',
    'business-trip': 'Business Trip',
    'child-sick': 'Child Sick Leave'
  };

  const TYPE_COLORS: Record<string, string> = {
    'sick': '#EF4444',
    'holiday': '#10B981',
    'business-trip': '#F59E0B',
    'child-sick': '#EC4899'
  };

  function isToday(date: dayjs.Dayjs): boolean {
    return date.isSame(dayjs(), 'day');
  }

  // Check if there are any running sessions
  function hasRunningSessions(): boolean {
    return timeLogs.some(tl => tl.start_timestamp && !tl.end_timestamp);
  }

  // Set up interval to refresh running sessions every 30 seconds
  onMount(() => {
    intervalId = window.setInterval(() => {
      if (hasRunningSessions()) {
        refreshTick++;
      } else if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    }, 30000); // Update every 30 seconds
  });

  onDestroy(() => {
    if (intervalId) {
      window.clearInterval(intervalId);
    }
  });

  // Timelog management handlers
  function handleAddTimelog() {
    editingTimelog = null;
    showTimelogForm = true;
  }

  function handleEditTimelog(session: Session) {
    editingTimelog = session;
    showTimelogForm = true;
  }

  function handleSaveTimelog(newLog: TimeLog) {
    saveTimelog(newLog, editingTimelog?.log).then(res => {
      // Close the TimelogForm after saving
      showTimelogForm = false;
      editingTimelog = null;
    });
  }

  function handleCloseForm() {
    showTimelogForm = false;
    editingTimelog = null;
  }

  async function handleDelete(log: TimeLog) {
    console.log('Deleting session:', log);
    await timeLogsStore.delete(log);
    showTimelogForm = false;
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">
      {selectedDate.format('MMMM D, YYYY')}
      {#if isToday(selectedDate)}
        <span class="text-sm font-normal text-primary">(Today)</span>
      {/if}
    </h2>
    <button
      onclick={handleAddTimelog}
      class="rounded-full bg-primary hover:bg-primary-hover transition-colors flex items-center gap-1 icon-[si--add-circle-duotone]"
      style="width: 32px; height: 32px;"
      aria-label="Add time entry"
    ></button>
  </div>

  <!-- Filter Dropdown -->
  <div class="mb-4">
    <label for="timer-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      Filter by timer:
    </label>
    <select
      id="timer-filter"
      bind:value={selectedTimerFilter}
      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <option value={null}>All Timers</option>
      {#each uniqueTimers as timer}
        <option value={timer.id}>
          {timer.emoji ? `${timer.emoji} ` : ''}{timer.name}
        </option>
      {/each}
    </select>
  </div>

  <!-- Special Type Sessions (Sick, Holiday, etc.) -->
  {#if filteredMultiDaySessions.length > 0}
    <div class="mb-6 space-y-2">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Multi-Day Entries</h3>
      {#each filteredMultiDaySessions as session}
        {@const timer = timers.find(t => t.id === session.timer_id)}
        {@const type = session.log?.type || 'normal'}
        {@const typeLabel = TYPE_LABELS[type] || type}
        {@const typeColor = TYPE_COLORS[type] || '#6B7280'}
        {@const logTimezone = session.log?.timezone || userTimezone}
        {@const isDifferentTimezone = logTimezone !== userTimezone}
        {@const startDate = session.startTime ? dayjs.utc(session.startTime).tz(logTimezone) : null}
        {@const endDate = session.endTime ? dayjs.utc(session.endTime).tz(logTimezone) : null}
        {@const isMultiDay = startDate && endDate && endDate.diff(startDate, 'day') >= 1}
        {@const dateRangeText = isMultiDay && startDate && endDate 
          ? `${startDate.format('MMM D')} - ${endDate.format('MMM D, YYYY')}`
          : startDate ? startDate.format('MMM D, YYYY') : ''}
        {@const timezoneText = isDifferentTimezone ? ` (${logTimezone})` : ''}
        {#if timer}
          <button
            onclick={() => handleEditTimelog(session)}
            class="w-full flex items-center gap-3 p-4 rounded-lg border-2 hover:shadow-md transition-all text-left"
            style="border-color: {typeColor}20; background-color: {typeColor}10;"
          >
            <div 
              class="w-4 h-4 rounded-full flex-shrink-0"
              style="background-color: {typeColor};"
            ></div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-semibold text-gray-800">{typeLabel}</span>
                <span class="text-gray-600">•</span>
                <span class="text-gray-700">
                  {timer.emoji ? `${timer.emoji} ` : ''}{timer.name}
                </span>
              </div>
              {#if isMultiDay}
                <p class="text-xs text-gray-600 mb-1">
                  📅 {dateRangeText}{timezoneText}
                </p>
              {:else if isDifferentTimezone}
                <p class="text-xs text-gray-600 mb-1">
                  🌍 {timezoneText}
                </p>
              {/if}
              {#if session.log?.notes}
                <p class="text-sm text-gray-600 truncate">{session.log.notes}</p>
              {/if}
              {#if session.duration}
                <p class="text-xs text-gray-500 mt-1">
                  {Math.floor(session.duration / 60)}h {session.duration % 60}m
                </p>
              {/if}
            </div>
          </button>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Public Holidays (displayed like whole_day timelogs) -->
  {#if relevantHolidays.length > 0}
    <div class="mb-6 space-y-2">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Public Holidays</h3>
      {#each relevantHolidays as holiday}
        <div 
          class="w-full flex items-center gap-3 p-4 rounded-lg border-2 text-left"
          style="border-color: #A855F720; background-color: #A855F710;"
        >
          <div 
            class="w-4 h-4 rounded-full flex-shrink-0 border-2 border-purple-500"
          ></div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-semibold text-gray-800">{holiday.name}</span>
            </div>
            <p class="text-xs text-gray-600">
              🎉 Public Holiday • {holiday.country}
            </p>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Timeline Section Header -->
  {#if filteredSessions.length > 0}
    <h3 class="text-sm font-semibold text-gray-700 mb-3">Timeline</h3>
  {/if}
  
  {#if filteredSessions.length > 0}
    <!-- Timeline View -->
    <div class="flex gap-4 mb-[60px]">
      <!-- Time Labels (Y-Axis) -->
      <div class="flex-1 grow-0 text-gray-500 relative" style="min-width: 50px;">
        {#each hourLabels as label, index}
          <div class="absolute right-0 text-right"
            style="top: {timelineHours > 0 ? (index / timelineHours) * 90 : 0}%;"
          >{label}</div>
        {/each}
      </div>

      <!-- Timeline Container -->
      <div class="flex-1 relative border-l-2 border-gray-200" style="min-height: {timelineHeight}px;">
        <!-- Hour grid lines -->
        {#each hourLabels as _, index}
          <div 
            class="absolute left-0 right-0 border-t border-gray-300 mt-[12px]"
            style="top: {timelineHours > 0 ? (index / timelineHours) * 90 : 0}%;"
          ></div>
        {/each}

        <!-- Session boxes -->
        {#each displaySessions as session}
          {@const timer = timers.find(t => t.id === session.timer_id)}
          {#if timer}
            <SessionBox 
              {session} 
              {timer} 
              {timelineStart} 
              {timelineEnd} 
              {timelineHeight} 
              {selectedDate}
              indentLevel={session.indentLevel} 
              edit={handleEditTimelog} 
            />
          {/if}
        {/each}
      </div>
    </div>
  {:else if sessions.length > 0 && selectedTimerFilter}
    <p class="text-gray-500 text-center py-8">No timeline activities for selected timer on this date</p>
  {:else if filteredMultiDaySessions.length === 0}
    <p class="text-gray-500 text-center py-8">No activities on this date</p>
  {/if}
</div>

<!-- Timelog Form Modal -->
{#if showTimelogForm}
  <TimelogForm
    {selectedDate}
    existingLog={editingTimelog?.log}
    save={handleSaveTimelog}
    close={handleCloseForm}
    del={handleDelete}
  />
{/if}
