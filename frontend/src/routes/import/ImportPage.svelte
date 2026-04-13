<script lang="ts">
  import { onMount } from 'svelte';
  import { navigate } from '../../lib/navigation';
  import { timeLogsStore } from '../../stores/timelogs';
  import { snackbar } from '../../stores/snackbar';
  import BottomNav from '../../components/BottomNav.svelte';
  import UploadStep from './UploadStep.svelte';
  import MappingStep from './MappingStep.svelte';
  import EditableTableStep from './EditableTableStep.svelte';
  import {
    parseCSV,
    autoDetectColumns,
    detectProjectColumn,
  } from '../../../../lib/utils/csvImport.js';
  import { _ } from '../../lib/i18n';

  // Step management
  let step = $state<'upload' | 'mapping' | 'edit'>('upload');
  
  // Track where we came from
  let returnPath = $state('/history');
  
  onMount(() => {
    // Check if there's a 'from' query parameter
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    if (from === 'table') {
      returnPath = '/table';
    } else {
      returnPath = '/history';
    }
  });
  
  // File state
  let file = $state<File | null>(null);
  let errorMessage = $state('');
  let warningMessage = $state('');
  
  // Parsed data
  let headers = $state<string[]>([]);
  let parsedData = $state<string[][]>([]);
  
  // Column mapping
  let startDateColumn = $state('');
  let endDateColumn = $state('');
  let startTimeColumn = $state('');
  let endTimeColumn = $state('');
  let notesColumn = $state('');
  let projectColumn = $state('');
  let typeColumn = $state('');
  let timezone = $state('Europe/Berlin');
  let customDateFormats = $state<string[]>([]);

  function handleFileSelect(selectedFile: File) {
    file = selectedFile;
    errorMessage = '';
    warningMessage = '';
  }

  const errMessages = {
    noFile: $_('import.noFileSelected'),
    emptyFile: $_('import.emptyCSVFile'),
    invalidFormat: $_('import.invalidCSVFormat'),
    failedParsing: $_('import.failedToParseCSV'),
    unexpectedError: $_('import.unexpectedErrorParsing'),
    missingColumns: $_('import.missingRequiredColumns'),
    noLogs: $_('import.noValidTimelogsToImport'),
    warnSemicolon: $_('import.semicolonDetected'),
    warnNoAutoDetect: $_('import.couldNotAutoDetectColumns'),
  };

  async function parseFile() {
    if (!file) {
      errorMessage = errMessages.noFile;
      return;
    }

    errorMessage = '';
    warningMessage = '';
    
    try {
      const text = await file.text();
      
      if (!text.trim()) {
        errorMessage = errMessages.emptyFile;
        return;
      }

      const parsed = parseCSV(text);
      
      headers = parsed.headers;
      parsedData = parsed.data;

      if (parsed.delimiter === ';') {
        warningMessage = errMessages.warnSemicolon;
      }

      // Auto-detect columns
      const detected = autoDetectColumns(parsed.headers);
      if (detected.startDateColumn) startDateColumn = detected.startDateColumn;
      if (detected.endDateColumn) endDateColumn = detected.endDateColumn;
      if (detected.startTimeColumn) startTimeColumn = detected.startTimeColumn;
      if (detected.endTimeColumn) endTimeColumn = detected.endTimeColumn;
      if (detected.notesColumn) notesColumn = detected.notesColumn;

      const detectedProjectColumn = detectProjectColumn(parsed.headers);
      if (detectedProjectColumn) {
        projectColumn = detectedProjectColumn;
      }

      if (!detected.startTimeColumn || !detected.endTimeColumn) {
        warningMessage = errMessages.warnNoAutoDetect;
      }

      step = 'mapping';
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('at least a header row')) {
          errorMessage = errMessages.invalidFormat;
        } else {
          errorMessage = errMessages.failedParsing + `\n\n${$_('common.error')}: ${error.message}`;
        }
      } else {
        errorMessage = errMessages.unexpectedError;
      }
      console.error('CSV parse error:', error);
    }
  }

  function handleMappingComplete() {
    if (!startTimeColumn || !endTimeColumn) {
      errorMessage = errMessages.missingColumns;
      return;
    }
    
    errorMessage = '';
    step = 'edit';
  }

  function goBackToUpload() {
    step = 'upload';
    headers = [];
    parsedData = [];
    startDateColumn = '';
    endDateColumn = '';
    startTimeColumn = '';
    endTimeColumn = '';
    notesColumn = '';
    projectColumn = '';
    typeColumn = '';
  }

  function goBackToMapping() {
    step = 'mapping';
    errorMessage = '';
  }

  function handleCancel() {
    navigate(returnPath);
  }

  async function handleImport(timelogs: Array<{
    timer_id: string;
    type: string;
    start_timestamp: string;
    end_timestamp: string;
    apply_break_calculation: boolean;
    notes?: string;
  }>) {
    try {
      if (timelogs.length === 0) {
        snackbar.error(errMessages.noLogs);
        return;
      }
      
      console.log('Starting import of', timelogs.length, 'timelogs');
      
      const createPromises = timelogs.map(async (log) => {
        try {
          const result = await timeLogsStore.create({
            timer_id: log.timer_id,
            type: log.type as any,
            start_timestamp: log.start_timestamp,
            end_timestamp: log.end_timestamp,
            apply_break_calculation: log.apply_break_calculation,
            notes: log.notes,
          });
          console.log('Successfully created timelog:', result.id);
          return result;
        } catch (err) {
          console.error('Failed to create timelog:', log, err);
          throw err;
        }
      });
      
      const results = await Promise.all(createPromises);
      console.log('Import completed, created:', results.length, 'timelogs');

      snackbar.success($_('import.successfullyImported' + timelogs.length));
      navigate(returnPath);
    } catch (error) {
      console.error('Import error:', error);
      snackbar.error($_('import.failedToImportTimelogs') + (error instanceof Error ? error.message : $_('common.unknownError')));
    }
  }
</script>

<div class="min-h-screen bg-gray-100 dark:bg-gray-900 pb-20">
  <!-- Header -->
  <header class="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
    <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          onclick={handleCancel}
          class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          aria-label={$_('import.goBack')}
        >
          <span class="icon-[si--arrow-left-line]" style="width: 24px; height: 24px;"></span>
        </button>
        <h1 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{$_('import.importTimelogs')}</h1>
      </div>
    </div>
  </header>

  <!-- Progress Steps -->
  <div class="max-w-4xl mx-auto px-4 py-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <div class="flex items-center justify-center gap-2">
        <div class="flex items-center gap-2">
          <span 
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white
              {step === 'upload' ? 'bg-blue-500 dark:bg-orange-500' : 'bg-green-500'}"
          >1</span>
          <span class="text-sm dark:text-gray-200" class:font-medium={step === 'upload'}>{$_('import.upload')}</span>
        </div>
        <div class="w-8 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
        <div class="flex items-center gap-2">
          <span 
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              {step === 'mapping' ? 'bg-blue-500 dark:bg-orange-500 text-white' : step === 'edit' ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}"
          >2</span>
          <span class="text-sm dark:text-gray-200" class:font-medium={step === 'mapping'}>{$_('import.mapColumns')}</span>
        </div>
        <div class="w-8 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
        <div class="flex items-center gap-2">
          <span 
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              {step === 'edit' ? 'bg-blue-500 dark:bg-orange-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}"
          >3</span>
          <span class="text-sm dark:text-gray-200" class:font-medium={step === 'edit'}>{$_('import.editAndImport')}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-4xl mx-auto px-4">
    {#if step === 'upload'}
      <UploadStep
        {file}
        {errorMessage}
        {warningMessage}
        onFileSelect={handleFileSelect}
        onContinue={parseFile}
        onCancel={handleCancel}
      />
    {:else if step === 'mapping'}
      <MappingStep
        {headers}
        {parsedData}
        bind:startDateColumn
        bind:endDateColumn
        bind:startTimeColumn
        bind:endTimeColumn
        bind:notesColumn
        bind:projectColumn
        bind:typeColumn
        bind:timezone
        bind:customDateFormats
        {errorMessage}
        {warningMessage}
        onContinue={handleMappingComplete}
        onBack={goBackToUpload}
      />
    {:else if step === 'edit'}
      <EditableTableStep
        {headers}
        {parsedData}
        {startDateColumn}
        {endDateColumn}
        {startTimeColumn}
        {endTimeColumn}
        {notesColumn}
        {projectColumn}
        {typeColumn}
        {timezone}
        bind:customDateFormats
        onImport={handleImport}
        onBack={goBackToMapping}
      />
    {/if}
  </div>
</div>

<BottomNav />
