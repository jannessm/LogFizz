<script lang="ts">
  import dayjs from 'dayjs';
  import { formatMinutesCompact as formatMinutes } from '../../../../lib/utils/timeFormat.js';

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

  function isToday(date: dayjs.Dayjs): boolean {
    return date.isSame(dayjs(), 'day');
  }

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
  }

  // Calculate position and height for a session in the timeline
  function getSessionStyle(session: any) {
    if (!timelineStart || !timelineEnd) return '';

    const start = dayjs(session.startTime);
    const end = session.endTime ? dayjs(session.endTime) : dayjs();
    
    const totalMinutes = timelineEnd.diff(timelineStart, 'minute');
    const startOffset = start.diff(timelineStart, 'minute');
    const duration = end.diff(start, 'minute');

    const topPercent = (startOffset / totalMinutes) * 90;
    const heightPercent = (duration / totalMinutes) * 90;
    
    // Ensure minimum height of 40px for very short entries
    const minHeightPercent = (40 / 400) * 90; // 40px min height relative to 400px min timeline
    const finalHeightPercent = Math.max(heightPercent, minHeightPercent);

    const button = buttons.find(b => b.id === session.button_id);
    const color = button?.color || '#3B82F6';

    return `top: ${topPercent}%; height: ${finalHeightPercent}%; min-height: 40px; background-color: ${color};`;
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

  $: if (selectedDate || timeLogs) {
    sessions = getSessionsForSelectedDate();
    calculateTimeline(sessions);

    filteredSessions = selectedButtonFilter 
      ? sessions.filter(s => s.button_id === selectedButtonFilter)
      : sessions;
    
    uniqueButtons = Array.from(new Set(sessions.map(s => s.button_id)))
      .map(id => buttons.find(b => b.id === id))
      .filter(b => b !== undefined);
  }
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
  {#if uniqueButtons.length > 1}
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
  {/if}
  
  {#if filteredSessions.length > 0}
    <!-- Timeline View -->
    <div class="flex gap-4">
      <!-- Time Labels (Y-Axis) -->
      <div class="flex-1 grow-0 text-gray-500 relative" style="min-width: 50px;">
        {#each getHourLabels() as label, index}
          <div class="absolute right-0 text-right"
            style="top: {(index / timelineHours) * 90}%;"
          >{label}</div>
        {/each}
      </div>

      <!-- Timeline Container -->
      <div class="flex-1 relative border-l-2 border-gray-200" style="min-height: 1000px;">
        <!-- Hour grid lines -->
        {#each getHourLabels() as _, index}
          <div 
            class="absolute left-0 right-0 border-t border-gray-100"
            style="top: {(index / timelineHours) * 90}%;"
          ></div>
        {/each}

        <!-- Session boxes -->
        {#each filteredSessions as session}
          {@const button = buttons.find(b => b.id === session.button_id)}
          {#if button}
            {@const duration = session.endTime 
              ? Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
              : null}
            <div
              class="absolute left-2 right-2 rounded-lg p-2 cursor-pointer transition-all hover:shadow-lg group"
              style={getSessionStyle(session)}
              on:click={() => onEditTimelog(session)}
              on:keydown={(e) => e.key === 'Enter' && onEditTimelog(session)}
              role="button"
              tabindex="0"
            >
              <div class="flex items-start justify-between gap-2 h-full">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1 text-white font-medium text-sm">
                    {#if button.emoji}
                      <span>{button.emoji}</span>
                    {/if}
                    <span class="truncate">{button.name}
                    {#if duration}
                      <span class="font-semibold">
                        ({formatMinutes(duration)})
                      </span>
                    {/if}
                    </span>
                  </div>
                  <div class="text-xs text-white opacity-90 mt-1">
                    {dayjs(session.startTime).format('HH:mm')}
                    {#if session.endTime}
                      - {dayjs(session.endTime).format('HH:mm')}
                    {:else}
                      - Running
                    {/if}
                  </div>
                </div>
                
                <!-- Action buttons (visible on hover) -->
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    on:click|stopPropagation={() => onEditTimelog(session)}
                    class="p-1 bg-white rounded icon-[si--edit-detailed-duotone] text-white"
                    style="width: 20px; height: 20px;"
                    aria-label="Edit entry"
                  ></button>
                </div>
              </div>
            </div>
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
