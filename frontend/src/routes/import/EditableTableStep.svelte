<script lang="ts">
  import { timers } from '../../stores/timers';
  import { dayjs } from '../../types';
  import { userTimezone } from '../../../../lib/utils/dayjs';
  import TimerSelectWithCreate from './TimerSelectWithCreate.svelte';
  import ImportRowEditor from './ImportRowEditor.svelte';
  import {
    combineDateAndTime,
    isValidDateTime,
    parseDateTime,
  } from '../../../../lib/utils/csvImport.js';
  import type { TimeLogType } from '../../../../lib/types';

  let {
    headers,
    parsedData,
    startDateColumn,
    endDateColumn,
    startTimeColumn,
    endTimeColumn,
    notesColumn,
    projectColumn,
    typeColumn,
    timezone,
    onImport,
    onBack,
  }: {
    headers: string[];
    parsedData: string[][];
    startDateColumn: string;
    endDateColumn: string;
    startTimeColumn: string;
    endTimeColumn: string;
    notesColumn: string;
    projectColumn: string;
    typeColumn: string;
    timezone: string;
    onImport: (timelogs: Array<{
      timer_id: string;
      type: string;
      start_timestamp: string;
      end_timestamp: string;
      notes?: string;
    }>) => void;
    onBack: () => void;
  } = $props();

  // Parsed and editable rows
  type EditableRow = {
    id: number;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    notes: string;
    project: string;
    type: TimeLogType;
    timerId: string;
    isValid: boolean;
    isSkipped: boolean;
    errorMsg?: string;
  };

  let rows = $state<EditableRow[]>([]);
  let globalTimerId = $state('');
  let currentPage = $state(0);
  const PAGE_SIZE = 20;

  // Initialize rows from parsed data
  $effect(() => {
    const startDateIdx = startDateColumn ? headers.indexOf(startDateColumn) : -1;
    const endDateIdx = endDateColumn ? headers.indexOf(endDateColumn) : -1;
    const startTimeIdx = headers.indexOf(startTimeColumn);
    const endTimeIdx = headers.indexOf(endTimeColumn);
    const notesIdx = notesColumn ? headers.indexOf(notesColumn) : -1;
    const projectIdx = projectColumn ? headers.indexOf(projectColumn) : -1;
    const typeIdx = typeColumn ? headers.indexOf(typeColumn) : -1;

    rows = parsedData.map((row, index) => {
      const startDate = startDateIdx >= 0 ? row[startDateIdx] || '' : '';
      const startTime = startTimeIdx >= 0 ? row[startTimeIdx] || '' : '';
      const endDate = endDateIdx >= 0 ? row[endDateIdx] || '' : startDate;
      const endTime = endTimeIdx >= 0 ? row[endTimeIdx] || '' : '';
      const notes = notesIdx >= 0 ? row[notesIdx] || '' : '';
      const project = projectIdx >= 0 ? row[projectIdx] || '' : '';
      
      // Parse type from CSV or default to 'normal'
      let type: TimeLogType = 'normal';
      if (typeIdx >= 0) {
        const typeValue = row[typeIdx]?.toLowerCase().trim() || '';
        if (['normal', 'sick', 'holiday', 'business-trip', 'child-sick'].includes(typeValue)) {
          type = typeValue as TimeLogType;
        }
      }

      const startStr = startDate ? `${startDate} ${startTime}` : startTime;
      const endStr = endDate ? `${endDate} ${endTime}` : endTime;
      const isValid = isValidDateTime(startStr) && isValidDateTime(endStr);

      return {
        id: index,
        startDate,
        startTime,
        endDate,
        endTime,
        notes,
        project,
        type,
        timerId: '',
        isValid,
        isSkipped: false,
        errorMsg: !isValid ? 'Invalid date/time' : undefined,
      };
    });
  });

  // Apply global timer to all rows
  function applyGlobalTimer() {
    if (!globalTimerId) return;
    rows = rows.map(row => ({ ...row, timerId: globalTimerId }));
  }

  // Computed values
  let paginatedRows = $derived.by(() => {
    const start = currentPage * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  });

  let totalPages = $derived(Math.ceil(rows.length / PAGE_SIZE));

  let validRowCount = $derived(
    rows.filter(r => !r.isSkipped && r.isValid && r.timerId).length
  );

  let invalidRowCount = $derived(
    rows.filter(r => !r.isSkipped && (!r.isValid || !r.timerId)).length
  );

  let skippedRowCount = $derived(
    rows.filter(r => r.isSkipped).length
  );

  function updateRow(id: number, updates: Partial<EditableRow>) {
    rows = rows.map(row => {
      if (row.id !== id) return row;
      
      const updated = { ...row, ...updates };
      
      // Revalidate
      const startStr = updated.startDate ? `${updated.startDate} ${updated.startTime}` : updated.startTime;
      const endStr = updated.endDate ? `${updated.endDate} ${updated.endTime}` : updated.endTime;
      updated.isValid = isValidDateTime(startStr) && isValidDateTime(endStr);
      updated.errorMsg = !updated.isValid ? 'Invalid date/time' : undefined;
      
      return updated;
    });
  }

  function toggleSkip(id: number) {
    rows = rows.map(row => 
      row.id === id ? { ...row, isSkipped: !row.isSkipped } : row
    );
  }

  function toggleSkipAll() {
    const allSkipped = rows.every(r => r.isSkipped);
    rows = rows.map(row => ({ ...row, isSkipped: !allSkipped }));
  }

  function handleImport() {
    const validRows = rows.filter(r => !r.isSkipped && r.isValid && r.timerId);
    
    console.log('EditableTableStep: Preparing import for', validRows.length, 'valid rows');
    
    const timelogs = validRows.map(row => {
      // Parse dates and times
      const startStr = row.startDate ? `${row.startDate} ${row.startTime}` : row.startTime;
      const endStr = row.endDate ? `${row.endDate} ${row.endTime}` : row.endTime;
      
      console.log('Parsing row:', { startStr, endStr, timezone });
      
      const startParsed = parseDateTime(startStr, timezone);
      const endParsed = parseDateTime(endStr, timezone);
      
      console.log('Parsed:', { 
        startParsed: startParsed?.toISOString(), 
        endParsed: endParsed?.toISOString() 
      });
      
      return {
        timer_id: row.timerId,
        type: row.type,
        start_timestamp: startParsed?.toISOString() || '',
        end_timestamp: endParsed?.toISOString() || '',
        notes: row.notes || undefined,
      };
    }).filter(log => log.start_timestamp && log.end_timestamp);

    console.log('EditableTableStep: Calling onImport with', timelogs.length, 'timelogs');
    console.log('First timelog to import:', timelogs[0]);
    
    onImport(timelogs);
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">Edit & Import</h2>
    <div class="text-sm text-gray-500 dark:text-gray-400">
      {validRowCount} valid, {invalidRowCount} need attention, {skippedRowCount} skipped
    </div>
  </div>

  <!-- Global Timer Assignment -->
  <div class="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
    <div class="flex items-end gap-4">
      <div class="flex-1">
        <label for="global-timer" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Assign all to timer
        </label>
        <TimerSelectWithCreate
          bind:value={globalTimerId}
          placeholder="Select timer for all rows..."
        />
      </div>
      <button
        onclick={applyGlobalTimer}
        disabled={!globalTimerId}
        class="px-4 py-2 bg-blue-600 dark:bg-orange-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-orange-600 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        Apply to All
      </button>
    </div>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="flex items-center justify-between mb-4">
      <button
        onclick={toggleSkipAll}
        class="text-sm text-blue-600 dark:text-orange-400 hover:underline"
      >
        {rows.every(r => r.isSkipped) ? 'Include All' : 'Skip All'}
      </button>
      
      <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <button
          onclick={() => currentPage = Math.max(0, currentPage - 1)}
          disabled={currentPage === 0}
          class="px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        <span>Page {currentPage + 1} / {totalPages}</span>
        <button
          onclick={() => currentPage = Math.min(totalPages - 1, currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          class="px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  {/if}

  <!-- Editable Table -->
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-gray-100 dark:bg-gray-700">
        <tr>
          <th class="px-2 py-2 text-left w-12">Skip</th>
          <th class="px-2 py-2 text-left w-10">#</th>
          <th class="px-2 py-2 text-left min-w-[120px]">Start Date</th>
          <th class="px-2 py-2 text-left min-w-[100px]">Start Time</th>
          <th class="px-2 py-2 text-left min-w-[120px]">End Date</th>
          <th class="px-2 py-2 text-left min-w-[100px]">End Time</th>
          <th class="px-2 py-2 text-left min-w-[120px]">Type</th>
          <th class="px-2 py-2 text-left min-w-[180px]">Timer</th>
          <th class="px-2 py-2 text-left min-w-[150px]">Notes</th>
          <th class="px-2 py-2 text-left w-16">Status</th>
        </tr>
      </thead>
      <tbody>
        {#each paginatedRows as row (row.id)}
          <ImportRowEditor
            {row}
            onUpdate={(updates) => updateRow(row.id, updates)}
            onToggleSkip={() => toggleSkip(row.id)}
          />
        {/each}
      </tbody>
    </table>
  </div>

  {#if rows.length === 0}
    <div class="text-center py-8 text-gray-500 dark:text-gray-400">
      No data to import.
    </div>
  {/if}

  <!-- Actions -->
  <div class="mt-6 flex justify-between items-center">
    <div class="text-sm text-gray-500 dark:text-gray-400">
      {#if invalidRowCount > 0}
        <span class="text-amber-600 dark:text-amber-400">
          ⚠️ {invalidRowCount} row{invalidRowCount !== 1 ? 's' : ''} need a timer assignment or have invalid dates
        </span>
      {/if}
    </div>
    <div class="flex gap-3">
      <button
        onclick={onBack}
        class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        Back
      </button>
      <button
        onclick={handleImport}
        disabled={validRowCount === 0}
        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        Import {validRowCount} Timelog{validRowCount !== 1 ? 's' : ''}
      </button>
    </div>
  </div>
</div>
