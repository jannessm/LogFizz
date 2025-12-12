<script lang="ts">
  import dayjs from 'dayjs';
  import utc from 'dayjs/plugin/utc';
  import timezone from 'dayjs/plugin/timezone';
  import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
  import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
  import { onMount, onDestroy } from 'svelte';
  import SessionBox from './SessionBox.svelte';
  import { computeIndentation } from '../../lib/utils/computeIndentation';
  import { holidaysStore } from '../../stores/holidays';
  import type { Holiday } from '../../../../lib/types';

  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.extend(isSameOrAfter);
  dayjs.extend(isSameOrBefore);

  // Get user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  export let selectedDate: dayjs.Dayjs;
  export let timeLogs: any[];
  export let buttons: any[];
  export let onAddTimelog: () => void;
  export let onEditTimelog: (session: any) => void;
  export let countries: string[] = []; // Countries to check for holidays

  let sessions: any[] = [];
  let specialTypeSessions: any[] = [];
  let normalSessions: any[] = [];
  let selectedButtonFilter: string | null = null;
  let filteredSessions: any[] = [];
  let filteredSpecialTypeSessions: any[] = [];
  let uniqueButtons: any[] = [];
  let timelineStart: dayjs.Dayjs | null = null;
  let timelineEnd: dayjs.Dayjs | null = null;
  let timelineHours: number = 0;
  let timelineHeight: number = 400; // px - computed to ensure minimum session box height
  let refreshTick = 0; // Used to trigger reactivity for running sessions
  let intervalId: number | undefined;
  let hourLabels: string[] = [];
  let currentHolidays: Holiday[] = [];

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

  // Get all holidays for the selected date across all configured countries
  function getHolidaysForDate(date: dayjs.Dayjs): Holiday[] {
    if (countries.length === 0) return [];
    const dateStr = date.format('YYYY-MM-DD');
    return $holidaysStore.holidays.filter(
      h => countries.includes(h.country) && h.date === dateStr
    );
  }

  // Get time logs for selected date - each log is already a session
  function getSessionsForSelectedDate() {
    const dateStr = selectedDate.format('YYYY-MM-DD');
    const now = dayjs();
    
    return timeLogs
      .filter(tl => {
        if (!tl.start_timestamp) return false;
        
        // Convert UTC timestamp to user's timezone for comparison
        const logTimezone = tl.timezone || userTimezone;
        const startDate = dayjs.utc(tl.start_timestamp).tz(logTimezone);
        
        // For multi-day logs, check if selected date falls within the range
        if (tl.end_timestamp) {
          const endDate = dayjs.utc(tl.end_timestamp).tz(logTimezone);
          const selectedDay = dayjs(dateStr).startOf('day');
          const logStart = startDate.startOf('day');
          const logEnd = endDate.startOf('day');
          
          // Check if selected date is within the range (inclusive)
          return selectedDay.isSameOrAfter(logStart) && selectedDay.isSameOrBefore(logEnd);
        }
        
        // For single-day or running logs, just check start date
        return startDate.format('YYYY-MM-DD') === dateStr;
      })
      .map(log => {
        // For running sessions (no end_timestamp), calculate duration to current time
        let duration = log.duration_minutes;
        if (!log.end_timestamp && log.start_timestamp) {
          const logTimezone = log.timezone || userTimezone;
          const start = dayjs.utc(log.start_timestamp).tz(logTimezone);
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
    
    // Split sessions into special types and normal
    specialTypeSessions = sessions.filter(s => s.log?.type && s.log.type !== 'normal');
    normalSessions = sessions.filter(s => !s.log?.type || s.log.type === 'normal');
    
    calculateTimeline(normalSessions);

    hourLabels = getHourLabels();

    // Apply filter to both special and normal sessions
    filteredSpecialTypeSessions = selectedButtonFilter 
      ? specialTypeSessions.filter(s => s.button_id === selectedButtonFilter)
      : specialTypeSessions;
    
    filteredSessions = selectedButtonFilter 
      ? normalSessions.filter(s => s.button_id === selectedButtonFilter)
      : normalSessions;
    
    uniqueButtons = Array.from(new Set(sessions.map(s => s.button_id)))
      .map(id => buttons.find(b => b.id === id))
      .filter(b => b !== undefined);

    // Get all holidays for selected date from all configured countries
    currentHolidays = getHolidaysForDate(selectedDate);
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

  <!-- Special Type Sessions (Sick, Holiday, etc.) -->
  {#if filteredSpecialTypeSessions.length > 0}
    <div class="mb-6 space-y-2">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Special Entries</h3>
      {#each filteredSpecialTypeSessions as session}
        {@const button = buttons.find(b => b.id === session.button_id)}
        {@const type = session.log?.type || 'normal'}
        {@const typeLabel = TYPE_LABELS[type] || type}
        {@const typeColor = TYPE_COLORS[type] || '#6B7280'}
        {@const logTimezone = session.log?.timezone || userTimezone}
        {@const startDate = session.startTime ? dayjs.utc(session.startTime).tz(logTimezone) : null}
        {@const endDate = session.endTime ? dayjs.utc(session.endTime).tz(logTimezone) : null}
        {@const isMultiDay = startDate && endDate && endDate.diff(startDate, 'day') >= 1}
        {@const dateRangeText = isMultiDay && startDate && endDate 
          ? `${startDate.format('MMM D')} - ${endDate.format('MMM D, YYYY')}`
          : startDate ? startDate.format('MMM D, YYYY') : ''}
        {#if button}
          <button
            on:click={() => onEditTimelog(session)}
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
                  {button.emoji ? `${button.emoji} ` : ''}{button.name}
                </span>
              </div>
              {#if isMultiDay}
                <p class="text-xs text-gray-600 mb-1">
                  📅 {dateRangeText}
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

  <!-- Public Holiday Banner -->
  {#if currentHolidays.length > 0}
    <div class="mb-4 space-y-2">
      {#each currentHolidays as holiday}
        <div class="p-3 rounded-lg bg-purple-50 border border-purple-200 flex items-center gap-2">
          <span class="text-purple-600 text-lg">🎉</span>
          <div class="flex-1">
            <p class="text-sm font-semibold text-purple-900">{holiday.name}</p>
            <p class="text-xs text-purple-700">Public Holiday • {holiday.country}</p>
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
    <p class="text-gray-500 text-center py-8">No timeline activities for selected button on this date</p>
  {:else if filteredSpecialTypeSessions.length === 0}
    <p class="text-gray-500 text-center py-8">No activities on this date</p>
  {/if}
</div>
