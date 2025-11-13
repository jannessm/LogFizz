<script lang="ts">
  import dayjs from 'dayjs';

  export let selectedDate: dayjs.Dayjs;
  export let sessions: any[];
  export let buttons: any[];
  export let onAddTimelog: () => void;
  export let onEditTimelog: (session: any) => void;
  export let onDeleteTimelog: (session: any) => void;

  let selectedButtonFilter: string | null = null;

  function formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  function isToday(date: dayjs.Dayjs): boolean {
    return date.isSame(dayjs(), 'day');
  }

  // Get unique buttons that have sessions
  $: uniqueButtons = Array.from(new Set(sessions.map(s => s.button_id)))
    .map(id => buttons.find(b => b.id === id))
    .filter(b => b !== undefined);

  // Filter sessions by selected button
  $: filteredSessions = selectedButtonFilter 
    ? sessions.filter(s => s.button_id === selectedButtonFilter)
    : sessions;
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
    <div class="space-y-3">
      {#each filteredSessions as session}
        {@const button = buttons.find(b => b.id === session.button_id)}
        {#if button}
          <div class="flex items-center gap-3 border-b border-gray-100 pb-3 last:border-b-0">
            <div
              class="w-3 h-3 rounded-full flex-shrink-0"
              style="background-color: {button.color || '#3B82F6'}"
            ></div>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                {#if button.emoji}
                  <span class="text-lg">{button.emoji}</span>
                {/if}
                <p class="font-medium text-gray-800">{button.name}</p>
              </div>
              <p class="text-sm text-gray-500">
                {dayjs(session.startTime).format('HH:mm')}
                {#if session.endTime}
                  - {dayjs(session.endTime).format('HH:mm')}
                {:else}
                  - Running...
                {/if}
              </p>
            </div>
            {#if session.endTime}
              {@const duration = Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)}
              <p class="text-sm font-semibold text-gray-700">{formatMinutes(duration)}</p>
            {/if}
            <div class="flex gap-1">
              <button
                on:click={() => onEditTimelog(session)}
                class="p-1 bg-gray-400 hover:bg-blue-600 rounded transition-colors icon-[si--edit-detailed-duotone]"
                style="width: 24px; height: 24px;"
                aria-label="Edit entry"
              >
              </button>
              <button
                on:click={() => onDeleteTimelog(session)}
                class="p-1 text-red-400 hover:bg-red-600 rounded transition-colors icon-[si--bin-duotone]"
                style="width: 24px; height: 24px;"
                aria-label="Delete entry"
              >
              </button>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {:else if sessions.length > 0 && selectedButtonFilter}
    <p class="text-gray-500 text-center py-8">No activities for selected button on this date</p>
  {:else}
    <p class="text-gray-500 text-center py-8">No activities on this date</p>
  {/if}
</div>
