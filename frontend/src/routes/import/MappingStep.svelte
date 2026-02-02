<script lang="ts">
  import {
    combineDateAndTime,
    isValidDateTime,
    parseDateTime,
    DATE_TIME_FORMATS,
  } from '../../../../lib/utils/csvImport.js';
  import { dayjs } from '../../types';
  import DateFormatModal from './DateFormatModal.svelte';
  import { _ } from '../../lib/i18n';

  let {
    headers,
    parsedData,
    startDateColumn = $bindable(),
    endDateColumn = $bindable(),
    startTimeColumn = $bindable(),
    endTimeColumn = $bindable(),
    notesColumn = $bindable(),
    projectColumn = $bindable(),
    typeColumn = $bindable(),
    timezone = $bindable(),
    customDateFormats = $bindable(),
    errorMessage,
    warningMessage,
    onContinue,
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
    customDateFormats: string[];
    errorMessage: string;
    warningMessage: string;
    onContinue: () => void;
    onBack: () => void;
  } = $props();

  let showFormatModal = $state(false);
  let formatValidationError = $state<string>('');

  // Helper to detect which format was used for parsing
  function detectUsedFormat(value: string, customFormats: string[] = []): string | null {
    if (!value) return null;
    
    // Try custom formats first
    for (const format of customFormats) {
      const parsed = dayjs(value, format, true);
      if (parsed.isValid()) {
        return format;
      }
    }
    
    // Try each standard format with STRICT parsing to find exact match
    for (const format of DATE_TIME_FORMATS) {
      const parsed = dayjs(value, format, true);
      if (parsed.isValid()) {
        return format;
      }
    }
    
    // Try native parsing as fallback
    const nativeDate = new Date(value);
    if (!isNaN(nativeDate.getTime())) {
      return 'Native Date parsing';
    }
    
    return null;
  }

  // Validate that all rows can be parsed with the same format
  type FormatValidationResult = {
    isValid: boolean;
    detectedFormat: string | null;
    invalidRows: number[];
    formatCounts: Map<string, number>;
    unparsedValues: string[];
    sampleValue: string; // Example datetime value from the data
  };

  function validateDateFormats(): FormatValidationResult {
    if (!startTimeColumn || !endTimeColumn || !parsedData.length) {
      return {
        isValid: true,
        detectedFormat: null,
        invalidRows: [],
        formatCounts: new Map(),
        unparsedValues: [],
        sampleValue: '',
      };
    }

    const startDateIndex = startDateColumn ? headers.indexOf(startDateColumn) : -1;
    const endDateIndex = endDateColumn ? headers.indexOf(endDateColumn) : -1;
    const startIndex = headers.indexOf(startTimeColumn);
    const endIndex = headers.indexOf(endTimeColumn);

    // Collect all datetime values
    const allDateTimes: string[] = [];
    parsedData.forEach((row) => {
      const startDateValue = startDateIndex >= 0 ? row[startDateIndex] || '' : '';
      const endDateValue = endDateIndex >= 0 ? row[endDateIndex] || '' : startDateValue;
      const startTime = row[startIndex] || '';
      const endTime = row[endIndex] || '';
      
      const start = combineDateAndTime(startDateValue, startTime);
      const end = combineDateAndTime(endDateValue, endTime);
      
      if (start) allDateTimes.push(start);
      if (end) allDateTimes.push(end);
    });

    // Get a sample value (prefer unparsable one, or first valid one)
    const sampleValue = allDateTimes[0] || '';

    // Try to find a format that works for ALL values
    let detectedFormat: string | null = null;
    const formatsToTry = [...customDateFormats, ...DATE_TIME_FORMATS];
    
    for (const format of formatsToTry) {
      let allValid = true;
      for (const value of allDateTimes) {
        const parsed = dayjs(value, format, true);
        if (!parsed.isValid()) {
          allValid = false;
          break;
        }
      }
      
      if (allValid) {
        detectedFormat = format;
        break; // Found a format that works for all values
      }
    }

    // If no single format works for all, fall back to checking with isValidDateTime
    // which tries all formats for each value
    const formatCounts = new Map<string, number>();
    const invalidRows: number[] = [];
    const unparsedValues: string[] = [];

    parsedData.forEach((row, index) => {
      const startDateValue = startDateIndex >= 0 ? row[startDateIndex] || '' : '';
      const endDateValue = endDateIndex >= 0 ? row[endDateIndex] || '' : startDateValue;
      const startTime = row[startIndex] || '';
      const endTime = row[endIndex] || '';
      
      const start = combineDateAndTime(startDateValue, startTime);
      const end = combineDateAndTime(endDateValue, endTime);
      
      const isValidStart = isValidDateTime(start, customDateFormats);
      const isValidEnd = isValidDateTime(end, customDateFormats);
      
      if (!isValidStart || !isValidEnd) {
        invalidRows.push(index + 2); // +2 for header row and 1-based indexing
        if (!isValidStart && !unparsedValues.includes(start)) {
          unparsedValues.push(start);
        }
        if (!isValidEnd && !unparsedValues.includes(end)) {
          unparsedValues.push(end);
        }
      } else {
        // Track which format was used (only if no universal format found)
        if (!detectedFormat) {
          const startFormat = detectUsedFormat(start, customDateFormats);
          const endFormat = detectUsedFormat(end, customDateFormats);
          
          if (startFormat) {
            formatCounts.set(startFormat, (formatCounts.get(startFormat) || 0) + 1);
          }
          if (endFormat && endFormat !== startFormat) {
            formatCounts.set(endFormat, (formatCounts.get(endFormat) || 0) + 1);
          }
        }
      }
    });

    // Prefer unparsed value as sample (what user needs to fix), otherwise use first value
    const preferredSampleValue = unparsedValues.length > 0 ? unparsedValues[0] : sampleValue;

    return {
      isValid: invalidRows.length === 0 && detectedFormat !== null,
      detectedFormat,
      invalidRows,
      formatCounts,
      unparsedValues,
      sampleValue: preferredSampleValue,
    };
  }

  // Reactive validation result
  let validationResult = $derived(validateDateFormats());

  // Update error message based on validation
  $effect(() => {
    if (!startTimeColumn || !endTimeColumn) {
      formatValidationError = '';
      return;
    }

    if (validationResult.invalidRows.length > 0) {
      // There are rows that cannot be parsed at all
      const rowCount = validationResult.invalidRows.length;
      const rowList = validationResult.invalidRows.slice(0, 5).join(', ');
      const more = validationResult.invalidRows.length > 5 ? `, and ${validationResult.invalidRows.length - 5} more` : '';
      
      formatValidationError = `⚠️ ${rowCount} row${rowCount > 1 ? 's' : ''} cannot be parsed: ${rowList}${more}\n\nUnparsed values:\n${validationResult.unparsedValues.slice(0, 3).map(v => `  "${v}"`).join('\n')}${validationResult.unparsedValues.length > 3 ? `\n  ...and ${validationResult.unparsedValues.length - 3} more` : ''}\n\nPlease select the correct date format.`;
    } else if (!validationResult.detectedFormat && validationResult.formatCounts.size > 1) {
      // All rows can be parsed, but no single format works for all rows
      const formatList = Array.from(validationResult.formatCounts.entries())
        .map(([format, count]) => `  • ${format}: ${count} values`)
        .join('\n');
      
      formatValidationError = `⚠️ No single format works for all rows. Multiple formats detected:\n${formatList}\n\nPlease select a custom format that works for all values, or ensure your data uses a consistent date format.`;
    } else {
      formatValidationError = '';
    }
  });

  // Handler for format modal
  function handleFormatSelected(format: string) {
    customDateFormats = [...customDateFormats, format];
    showFormatModal = false;
  }

  function handleContinue() {
    // If there are invalid rows, show the format modal
    if (!validationResult.isValid) {
      showFormatModal = true;
    } else {
      onContinue();
    }
  }

  // Preview of parsed data
  let previewLogs = $derived.by(() => {
    if (!startTimeColumn || !endTimeColumn || !parsedData.length) {
      return [];
    }

    const startDateIndex = startDateColumn ? headers.indexOf(startDateColumn) : -1;
    const endDateIndex = endDateColumn ? headers.indexOf(endDateColumn) : -1;
    const startIndex = headers.indexOf(startTimeColumn);
    const endIndex = headers.indexOf(endTimeColumn);

    return parsedData.slice(0, 5).map(row => {
      const startDateValue = startDateIndex >= 0 ? row[startDateIndex] || '' : '';
      const endDateValue = endDateIndex >= 0 ? row[endDateIndex] || '' : startDateValue;
      const startTime = row[startIndex] || '';
      const endTime = row[endIndex] || '';
      
      const start = combineDateAndTime(startDateValue, startTime);
      const end = combineDateAndTime(endDateValue, endTime);
      const isValidStart = isValidDateTime(start, customDateFormats);
      const isValidEnd = isValidDateTime(end, customDateFormats);
      const isValid = isValidStart && isValidEnd;
      
      // Detect format for debugging
      const startFormat = isValidStart ? detectUsedFormat(start, customDateFormats) : null;
      const endFormat = isValidEnd ? detectUsedFormat(end, customDateFormats) : null;
      
      return { 
        start, 
        end, 
        isValid,
        startFormat,
        endFormat,
        startDateValue,
        startTime,
        endDateValue,
        endTime,
      };
    });
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
  <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{$_('import.mapColumns')}</h2>
  
  <div class="space-y-4">
    <!-- Timezone -->
    <div>
      <label for="timezone" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
        {$_('import.timezoneRequired')}
      </label>
      <select
        id="timezone"
        bind:value={timezone}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      >
        <option value="UTC">UTC</option>
        <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
        <option value="Europe/London">Europe/London (GMT/BST)</option>
        <option value="America/New_York">America/New_York (EST/EDT)</option>
        <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
        <option value="America/Chicago">America/Chicago (CST/CDT)</option>
        <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
        <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
        <option value="Australia/Sydney">Australia/Sydney (AEDT/AEST)</option>
      </select>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {$_('import.selectTimezone')}
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Start Date Column -->
      <div>
        <label for="start-date-column" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Start Date Column (optional)
        </label>
        <select
          id="start-date-column"
          bind:value={startDateColumn}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">{$_('import.none')} (times include dates)</option>
          {#each headers as header}
            <option value={header}>{header}</option>
          {/each}
        </select>
      </div>

      <!-- End Date Column -->
      <div>
        <label for="end-date-column" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          End Date Column (optional)
        </label>
        <select
          id="end-date-column"
          bind:value={endDateColumn}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">{$_('import.useStartDate')}</option>
          {#each headers as header}
            <option value={header}>{header}</option>
          {/each}
        </select>
      </div>

      <!-- Start Time Column -->
      <div>
        <label for="start-column" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          {$_('import.startTimeColumn')}
        </label>
        <select
          id="start-column"
          bind:value={startTimeColumn}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">{$_('import.selectColumn')}</option>
          {#each headers as header}
            <option value={header}>{header}</option>
          {/each}
        </select>
      </div>

      <!-- End Time Column -->
      <div>
        <label for="end-column" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          {$_('import.endTimeColumn')}
        </label>
        <select
          id="end-column"
          bind:value={endTimeColumn}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">{$_('import.selectColumn')}</option>
          {#each headers as header}
            <option value={header}>{header}</option>
          {/each}
        </select>
      </div>

      <!-- Notes Column -->
      <div>
        <label for="notes-column" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Notes Column (optional)
        </label>
        <select
          id="notes-column"
          bind:value={notesColumn}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">{$_('import.none')}</option>
          {#each headers as header}
            <option value={header}>{header}</option>
          {/each}
        </select>
      </div>

      <!-- Project Column -->
      <div>
        <label for="project-column" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Project/Timer Column (optional)
        </label>
        <select
          id="project-column"
          bind:value={projectColumn}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">{$_('import.none')}</option>
          {#each headers as header}
            <option value={header}>{header}</option>
          {/each}
        </select>
      </div>

      <!-- Type Column -->
      <div>
        <label for="type-column" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Type Column (optional)
        </label>
        <select
          id="type-column"
          bind:value={typeColumn}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">{$_('import.none')} (default to Normal)</option>
          {#each headers as header}
            <option value={header}>{header}</option>
          {/each}
        </select>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {$_('import.allowedTypes')}
        </p>
      </div>
    </div>

    <!-- Preview -->
    {#if previewLogs.length > 0}
      <div class="mt-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-200">Preview (first 5 rows):</h3>
          <div class="flex items-center gap-3">
            {#if validationResult.detectedFormat}
              <span class="text-xs text-blue-600 dark:text-blue-400 font-mono">
                Format: {validationResult.detectedFormat}
              </span>
            {/if}
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {parsedData.length - validationResult.invalidRows.length} / {parsedData.length} valid
            </span>
          </div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
          {#each previewLogs as log, index}
            <div 
              class="flex items-start gap-2 text-sm p-2 rounded {log.isValid ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}"
            >
              <span class="w-4 h-4 mt-0.5 flex-shrink-0" 
                class:icon-[si--check-circle-line]={log.isValid}
                class:icon-[si--close-circle-line]={!log.isValid}
              ></span>
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">Row {index + 2}: {log.start} → {log.end}</div>
                {#if log.isValid}
                  <div class="text-xs mt-0.5 opacity-80">
                    Format: {log.startFormat || 'Unknown'}
                  </div>
                {:else}
                  <div class="text-xs mt-1 opacity-90 space-y-0.5">
                    <div>{$_('import.invalidDateFormat')}</div>
                    <div class="font-mono bg-white dark:bg-gray-800 p-1 rounded text-[10px]">
                      Date: "{log.startDateValue}" + Time: "{log.startTime}"
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if formatValidationError}
      <div class="mt-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-300 text-sm whitespace-pre-line">
        {formatValidationError}
      </div>
    {/if}

    {#if errorMessage}
      <div class="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-800 dark:text-red-300 text-sm whitespace-pre-line">
        {errorMessage}
      </div>
    {/if}

    {#if warningMessage}
      <div class="mt-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-300 text-sm whitespace-pre-line">
        {warningMessage}
      </div>
    {/if}

    <div class="mt-6 flex justify-end gap-3">
      <button
        onclick={onBack}
        class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        {$_('import.back')}
      </button>
      <button
        onclick={handleContinue}
        disabled={!startTimeColumn || !endTimeColumn}
        class="px-4 py-2 bg-blue-600 dark:bg-orange-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-orange-600 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        {$_('import.continue')}
      </button>
    </div>
  </div>
</div>

{#if showFormatModal}
  <DateFormatModal
    {timezone}
    sampleValue={validationResult.sampleValue}
    onFormatSelected={handleFormatSelected}
    onClose={() => showFormatModal = false}
  />
{/if}