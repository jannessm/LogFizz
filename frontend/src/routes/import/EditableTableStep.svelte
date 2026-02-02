<script lang="ts">
  import { timers } from '../../stores/timers';
  import { dayjs } from '../../types';
  import { userTimezone } from '../../../../lib/utils/dayjs';
  import TimerSelectWithCreate from './TimerSelectWithCreate.svelte';
  import ImportRowEditor from './ImportRowEditor.svelte';
  import DateFormatModal from './DateFormatModal.svelte';
  import {
    combineDateAndTime,
    isValidDateTime,
    parseDateTime,
  } from '../../../../lib/utils/csvImport.js';
  import type { TimeLogType } from '../../../../lib/types';
  import { _ } from '../../lib/i18n';

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
    customDateFormats = $bindable([]),
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
    customDateFormats?: string[];
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
  
  // Modal state
  let showFormatModal = $state(false);
  let formatModalSample = $state('');

  // Helper to normalize date to YYYY-MM-DD format for date inputs
  function normalizeDateForInput(dateStr: string): string {
    if (!dateStr) return '';
    
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Try parsing with custom formats first (if available)
    if (customDateFormats && customDateFormats.length > 0) {
      for (const fullFormat of customDateFormats) {
        // Extract date-only format by removing time components
        const dateOnlyFormat = fullFormat
          .replace(/\s*h:mm\s*A/gi, '')  // Remove " h:mm A"
          .replace(/\s*HH:mm:ss/gi, '')  // Remove " HH:mm:ss"
          .replace(/\s*HH:mm/gi, '')     // Remove " HH:mm"
          .replace(/\s*LT/gi, '')        // Remove " LT"
          .replace(/\s*LTS/gi, '')       // Remove " LTS"
          .trim();
        
        // Try date-only format first, then full format
        for (const format of [dateOnlyFormat, fullFormat]) {
          if (!format) continue;
          try {
            const parsed = dayjs(dateStr, format, true);
            if (parsed.isValid()) {
              return parsed.format('YYYY-MM-DD');
            }
          } catch (e) {
            // Continue to next format
          }
        }
      }
    }
    
    // Try DD/MM/YYYY or MM/DD/YYYY format
    const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const first = slashMatch[1].padStart(2, '0');
      const second = slashMatch[2].padStart(2, '0');
      const year = slashMatch[3];
      
      // Try DD/MM/YYYY first (European format)
      const ddmmResult = `${year}-${second}-${first}`;
      const ddmmDate = dayjs(ddmmResult, 'YYYY-MM-DD', true);
      if (ddmmDate.isValid()) {
        return ddmmResult;
      }
      
      // Fall back to MM/DD/YYYY (US format)
      const mmddResult = `${year}-${first}-${second}`;
      const mmddDate = dayjs(mmddResult, 'YYYY-MM-DD', true);
      if (mmddDate.isValid()) {
        return mmddResult;
      }
      
      // If neither is valid, return the DD/MM attempt
      return ddmmResult;
    }
    
    // Try DD.MM.YYYY format
    const dotMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dotMatch) {
      const day = dotMatch[1].padStart(2, '0');
      const month = dotMatch[2].padStart(2, '0');
      const year = dotMatch[3];
      return `${year}-${month}-${day}`;
    }
    
    return dateStr;
  }

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
      const startDateRaw = startDateIdx >= 0 ? row[startDateIdx] || '' : '';
      const startTime = startTimeIdx >= 0 ? row[startTimeIdx] || '' : '';
      const endDateRaw = endDateIdx >= 0 ? row[endDateIdx] || '' : startDateRaw;
      const endTime = endTimeIdx >= 0 ? row[endTimeIdx] || '' : '';
      const notes = notesIdx >= 0 ? row[notesIdx] || '' : '';
      const project = projectIdx >= 0 ? row[projectIdx] || '' : '';
      
      // Normalize dates to YYYY-MM-DD for date inputs
      const startDate = normalizeDateForInput(startDateRaw);
      const endDate = normalizeDateForInput(endDateRaw);
      
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
      const isValid = isValidDateTime(startStr, customDateFormats) && isValidDateTime(endStr, customDateFormats);

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
        errorMsg: !isValid ? $_('import.invalidDateFormat') : undefined,
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
      updated.isValid = isValidDateTime(startStr, customDateFormats) && isValidDateTime(endStr, customDateFormats);
      updated.errorMsg = !updated.isValid ? $_('import.invalidDateFormat') : undefined;
      
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
      
      const startParsed = parseDateTime(startStr, timezone, customDateFormats);
      const endParsed = parseDateTime(endStr, timezone, customDateFormats);
      
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
    <div class="flex items-center gap-4">
      <div class="text-sm text-gray-500 dark:text-gray-400">
        {validRowCount} valid, {invalidRowCount} need attention, {skippedRowCount} skipped
      </div>
    </div>
  </div>

  <!-- Global Timer Assignment -->
  <div class="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
    <div class="flex items-end gap-4">
      <div class="flex-1">
        <label for="global-timer" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          {$_('import.assignAllToTimer')}
        </label>
        <TimerSelectWithCreate
          bind:value={globalTimerId}
          placeholder={$_('import.selectTimerForAll')}
        />
      </div>
      <button
        onclick={applyGlobalTimer}
        disabled={!globalTimerId}
        class="px-4 py-2 bg-blue-600 dark:bg-orange-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-orange-600 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        {$_('import.applyToAll')}
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
          ← {$_('common.previous')}
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
          <th class="px-2 py-2 text-left w-12">{$_('import.skip')}</th>
          <th class="px-2 py-2 text-left w-10">#</th>
          <th class="px-2 py-2 text-left min-w-[120px]">{$_('export.startDate')}</th>
          <th class="px-2 py-2 text-left min-w-[100px]">{$_('export.startTime')}</th>
          <th class="px-2 py-2 text-left min-w-[120px]">{$_('export.endDate')}</th>
          <th class="px-2 py-2 text-left min-w-[100px]">{$_('export.endTime')}</th>
          <th class="px-2 py-2 text-left min-w-[120px]">{$_('timelog.type')}</th>
          <th class="px-2 py-2 text-left min-w-[180px]">{$_('table.timer')}</th>
          <th class="px-2 py-2 text-left min-w-[150px]">{$_('timelog.notes')}</th>
          <th class="px-2 py-2 text-left w-16">{$_('import.status')}</th>
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
      {$_('import.noDataToImport')}
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
        {$_('import.back')}
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
