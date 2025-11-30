<script lang="ts">
  import dayjs from 'dayjs';
  import { onMount, onDestroy } from 'svelte';
  import SessionBox from './SessionBox.svelte';
  import { computeIndentation } from '../../lib/utils/computeIndentation';

  export let selectedDate: dayjs.Dayjs;
  export let timeLogs: any[];
  export let buttons: any[];
  export let onAddTimelog: () => void;
  export let onEditTimelog: (session: any) => void;
  export let onDeleteTimelog: (session: any) => void;

  let sessions: any[] = [];
  let selectedButtonFilter: string | null = null;
  let filteredSessions: any[] = [];
  let uniqueButtons: any[] = [];
  let timelineStart: dayjs.Dayjs | null = null;
  let timelineEnd: dayjs.Dayjs | null = null;
  let timelineHours: number = 0;
  let timelineHeight: number = 400; // px - computed to ensure minimum session box height
  let refreshTick = 0; // Used to trigger reactivity for running sessions
  let intervalId: number | undefined;
  let hourLabels: string[] = [];

  function isToday(date: dayjs.Dayjs): boolean {
    return date.isSame(dayjs(), 'day');
  }

  // Get time logs for selected date - each log is already a session
  function getSessionsForSelectedDate() {
    const dateStr = selectedDate.format('YYYY-MM-DD');
    const now = dayjs();
    
    return timeLogs
      .filter(tl => tl.start_timestamp && tl.start_timestamp.startsWith(dateStr))
      .map(log => {
        // For running sessions (no end_timestamp), calculate duration to current time
        let duration = log.duration_minutes;
        if (!log.end_timestamp && log.start_timestamp) {
          const start = dayjs(log.start_timestamp);
          duration = now.diff(start, 'minute');
        }
        
        return {
          button_id: log.button_id,
          startTime: log.start_timestamp,
          endTime: log.end_timestamp,
          duration: duration,
          log: log,
        };
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  // Calculate timeline bounds and position for each session
  function calculateTimeline(sessions: any[]) {
    if (sessions.length === 0) {
      timelineStart = null;
      timelineEnd = null;
      timelineHours = 0;
      return;
    }

    // Find earliest start and latest end
    let earliest = dayjs(sessions[0].startTime);
    let latest = dayjs(sessions[0].startTime);

    for (const session of sessions) {
      const start = dayjs(session.startTime);
      const end = session.endTime ? dayjs(session.endTime) : dayjs();

      if (start.isBefore(earliest)) earliest = start;
      if (end.isAfter(latest)) latest = end;
    }

    // Round to nearest hour for cleaner display
    timelineStart = earliest.startOf('hour');
    timelineEnd = latest.add(1, 'hour').startOf('hour');
    timelineHours = timelineEnd.diff(timelineStart, 'hour');

    // Compute required timeline height (px) so that the minimum session box height is 60px
    const totalMinutes = timelineEnd.diff(timelineStart, 'minute');
    const MIN_BOX_PX = 60;
    const MIN_HEIGHT_PX = 100; // baseline minimum timeline height
    const MIN_LABEL_SPACING_PX = 60; // ensure at least 60px between hour labels

    let requiredHeight = MIN_HEIGHT_PX;
    if (totalMinutes > 0) {
      for (const session of sessions) {
        const start = dayjs(session.startTime);
        const end = session.endTime ? dayjs(session.endTime) : dayjs();
        const duration = end.diff(start, 'minute');
        if (!duration || duration <= 0) continue;

        // For a given session, we need H such that (duration / totalMinutes) * 0.9 * H >= MIN_BOX_PX
        // => H >= (MIN_BOX_PX * totalMinutes) / (duration * 0.9)
        const needed = Math.ceil((MIN_BOX_PX * totalMinutes) / (duration * 0.9));
        if (needed > requiredHeight) requiredHeight = needed;
      }
    }

    // Also ensure hour labels are spaced at least MIN_LABEL_SPACING_PX apart
    let minHeightForLabels = MIN_HEIGHT_PX;
    if (timelineHours > 0) {
      // label spacing in px = (timelineHeight * 0.9) / timelineHours
      // so required timelineHeight >= (MIN_LABEL_SPACING_PX * timelineHours) / 0.9
      minHeightForLabels = Math.ceil((MIN_LABEL_SPACING_PX * timelineHours) / 0.9);
    }

    timelineHeight = Math.max(MIN_HEIGHT_PX, requiredHeight, minHeightForLabels);
  }

  // Generate hour labels for timeline
  function getHourLabels(): string[] {
    if (!timelineStart || timelineHours === 0) return [];
    
    const labels: string[] = [];
    for (let i = 0; i <= timelineHours; i++) {
      labels.push(timelineStart.add(i, 'hour').format('HH:mm'));
    }
    return labels;
  }

  $: if (selectedDate || timeLogs || refreshTick) {
    sessions = getSessionsForSelectedDate();
    calculateTimeline(sessions);

    hourLabels = getHourLabels();

    filteredSessions = selectedButtonFilter 
      ? sessions.filter(s => s.button_id === selectedButtonFilter)
      : sessions;
    
    uniqueButtons = Array.from(new Set(sessions.map(s => s.button_id)))
      .map(id => buttons.find(b => b.id === id))
      .filter(b => b !== undefined);
  }

  $: displaySessions = computeIndentation(filteredSessions || []);

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
</script>

<div class="bg-white rounded-lg shadow-md p-6">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-semibold text-gray-800">
      {selectedDate.format('MMMM D, YYYY')}
      {#if isToday(selectedDate)}
        <span class="text-sm font-normal text-blue-600">(Today)</span>
      {/if}
    </h2>
    <button
      on:click={onAddTimelog}
      class="rounded-full bg-blue-500 hover:bg-blue-700 transition-colors flex items-center gap-1 icon-[si--add-circle-duotone]"
      style="width: 32px; height: 32px;"
      aria-label="Add time entry"
    ></button>
  </div>

  <!-- Filter Dropdown -->
  <div class="mb-4">
    <label for="button-filter" class="block text-sm font-medium text-gray-700 mb-2">
      Filter by button:
    </label>
    <select
      id="button-filter"
      bind:value={selectedButtonFilter}
      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value={null}>All Buttons</option>
      {#each uniqueButtons as button}
        <option value={button.id}>
          {button.emoji ? `${button.emoji} ` : ''}{button.name}
        </option>
      {/each}
    </select>
  </div>
  
  {#if filteredSessions.length > 0}
    <!-- Timeline View -->
    <div class="flex gap-4">
      <!-- Time Labels (Y-Axis) -->
      <div class="flex-1 grow-0 text-gray-500 relative" style="min-width: 50px;">
        {#each hourLabels as label, index}
          <div class="absolute right-0 text-right"
            style="top: {(index / timelineHours) * 90}%;"
          >{label}</div>
        {/each}
      </div>

      <!-- Timeline Container -->
  <div class="flex-1 relative border-l-2 border-gray-200" style="min-height: {timelineHeight}px;">
        <!-- Hour grid lines -->
        {#each hourLabels as _, index}
          <div 
            class="absolute left-0 right-0 border-t border-gray-300 mt-[12px]"
            style="top: {(index / timelineHours) * 90}%;"
          ></div>
        {/each}

        <!-- Session boxes -->
        {#each displaySessions as session}
          {@const button = buttons.find(b => b.id === session.button_id)}
          {#if button}
            <SessionBox {session} {button} {timelineStart} {timelineEnd} {timelineHeight} indentLevel={session.indentLevel} onEdit={onEditTimelog} />
          {/if}
        {/each}
      </div>
    </div>
  {:else if sessions.length > 0 && selectedButtonFilter}
    <p class="text-gray-500 text-center py-8">No activities for selected button on this date</p>
  {:else}
    <p class="text-gray-500 text-center py-8">No activities on this date</p>
  {/if}
</div>
