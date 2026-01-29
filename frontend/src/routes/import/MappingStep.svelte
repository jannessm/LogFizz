<script lang="ts">
  import {
    combineDateAndTime,
    isValidDateTime,
  } from '../../../../lib/utils/csvImport.js';

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
    errorMessage: string;
    warningMessage: string;
    onContinue: () => void;
    onBack: () => void;
  } = $props();

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
      const isValid = isValidDateTime(start) && isValidDateTime(end);
      return { start, end, isValid };
    });
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
  <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Map Columns</h2>
  
  <div class="space-y-4">
    <!-- Timezone -->
    <div>
      <label for="timezone" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
        Timezone *
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
        Select the timezone for the times in your CSV
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
          <option value="">None (times include dates)</option>
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
          <option value="">Use start date</option>
          {#each headers as header}
            <option value={header}>{header}</option>
          {/each}
        </select>
      </div>

      <!-- Start Time Column -->
      <div>
        <label for="start-column" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Start Time Column *
        </label>
        <select
          id="start-column"
          bind:value={startTimeColumn}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">Select column...</option>
          {#each headers as header}
            <option value={header}>{header}</option>
          {/each}
        </select>
      </div>

      <!-- End Time Column -->
      <div>
        <label for="end-column" class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          End Time Column *
        </label>
        <select
          id="end-column"
          bind:value={endTimeColumn}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">Select column...</option>
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
          <option value="">None</option>
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
          <option value="">None</option>
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
          <option value="">None (default to Normal)</option>
          {#each headers as header}
            <option value={header}>{header}</option>
          {/each}
        </select>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Allowed types: normal, sick, holiday, business-trip, child-sick
        </p>
      </div>
    </div>

    <!-- Preview -->
    {#if previewLogs.length > 0}
      <div class="mt-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-200">Preview (first 5 rows):</h3>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {previewLogs.filter(l => l.isValid).length} / {previewLogs.length} valid
          </span>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
          {#each previewLogs as log}
            <div 
              class="flex items-start gap-2 text-sm p-2 rounded {log.isValid ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}"
            >
              <span class="w-4 h-4 mt-0.5 flex-shrink-0" 
                class:icon-[si--check-circle-line]={log.isValid}
                class:icon-[si--close-circle-line]={!log.isValid}
              ></span>
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">{log.start} → {log.end}</div>
                {#if !log.isValid}
                  <div class="text-xs mt-0.5 opacity-80">Invalid date/time format</div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
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
        Back
      </button>
      <button
        onclick={onContinue}
        disabled={!startTimeColumn || !endTimeColumn}
        class="px-4 py-2 bg-blue-600 dark:bg-orange-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-orange-600 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </div>
  </div>
</div>
