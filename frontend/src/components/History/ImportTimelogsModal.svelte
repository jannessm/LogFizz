<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { buttonsStore } from '../../stores/buttons';
  import ButtonForm from '../ButtonForm.svelte';
  import {
    parseCSV,
    autoDetectColumns,
    combineDateAndTime,
    isValidDateTime,
    parseDateTime,
    processTimelogRows,
    validateAndConvertTimelogs,
    detectProjectColumn,
    detectProjectsInCSV,
    type ParsedCSV,
    type AutoDetectedColumns,
    type DetectedProject,
  } from '../../../../lib/utils/csvImport.js';

  const dispatch = createEventDispatcher();

  // Constants
  const MAX_DISPLAYED_ERRORS = 5;

  let file: File | null = null;
  let fileType: 'csv' | 'pdf' | null = null;
  let fileInput: HTMLInputElement;
  let step: 'upload' | 'mapping' | 'project-mapping' | 'confirm' = 'upload';
  let parsedData: string[][] = [];
  let headers: string[] = [];
  let dateColumn: string = '';
  let startTimeColumn: string = '';
  let endTimeColumn: string = '';
  let notesColumn: string = '';
  let projectColumn: string = '';
  let detectedProjects: DetectedProject[] = [];
  let projectMappings: Map<string, { action: 'assign' | 'ignore' | 'create'; buttonId?: string }> = new Map();
  let selectedButtonId: string = '';
  let previewLogs: { start: string; end: string; isValid: boolean }[] = [];
  let errorMessage: string = '';
  let warningMessage: string = '';
  let validationErrors: string[] = [];
  let showErrorDetails = false;
  let showButtonForm = false;
  let currentProjectForButton: string | null = null;

  function detectFileType(fileName: string): 'csv' | 'pdf' | null {
    const extension = fileName.toLowerCase().split('.').pop();
    if (extension === 'csv') return 'csv';
    if (extension === 'pdf') return 'pdf';
    return null;
  }

  $: buttons = $buttonsStore.buttons;

  function handleClose() {
    dispatch('close');
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const selectedFile = input.files[0];
      const detectedType = detectFileType(selectedFile.name);
      
      if (!detectedType) {
        errorMessage = '❌ Invalid file type. Please upload a CSV or PDF file.\n\nSupported formats:\n• .csv (Comma or semicolon separated)\n• .pdf (Text-based PDFs only)';
        file = null;
        fileType = null;
        return;
      }
      
      file = selectedFile;
      fileType = detectedType;
      errorMessage = '';
      warningMessage = '';
      validationErrors = [];
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const droppedFile = event.dataTransfer.files[0];
      const detectedType = detectFileType(droppedFile.name);
      
      if (!detectedType) {
        errorMessage = '❌ Invalid file type. Please upload a CSV or PDF file.\n\nSupported formats:\n• .csv (Comma or semicolon separated)\n• .pdf (Text-based PDFs only)';
        file = null;
        fileType = null;
        return;
      }
      
      file = droppedFile;
      fileType = detectedType;
      errorMessage = '';
      warningMessage = '';
      validationErrors = [];
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  async function parseFile() {
    if (!file) {
      errorMessage = '❌ No file selected. Please select a file to import.';
      return;
    }

    errorMessage = '';
    warningMessage = '';
    validationErrors = [];
    
    if (fileType === 'csv') {
      await parseCSVFile();
    } else {
      await parsePDF();
    }
  }

  async function parseCSVFile() {
    try {
      const text = await file!.text();
      
      if (!text.trim()) {
        errorMessage = '❌ The CSV file is empty. Please provide a file with data.';
        return;
      }

      const parsed = parseCSV(text);
      
      headers = parsed.headers;
      parsedData = parsed.data;

      // Show info about detected delimiter
      if (parsed.delimiter === ';') {
        warningMessage = `ℹ️ Detected semicolon-separated CSV (common in European formats)`;
      }

      // Auto-detect date and time columns
      const detected = autoDetectColumns(parsed.headers);
      if (detected.dateColumn) dateColumn = detected.dateColumn;
      if (detected.startTimeColumn) startTimeColumn = detected.startTimeColumn;
      if (detected.endTimeColumn) endTimeColumn = detected.endTimeColumn;
      if (detected.notesColumn) notesColumn = detected.notesColumn;

      // Auto-detect project column
      const detectedProjectColumn = detectProjectColumn(parsed.headers);
      if (detectedProjectColumn) {
        projectColumn = detectedProjectColumn;
      }

      // Warn if columns weren't auto-detected
      if (!detected.startTimeColumn || !detected.endTimeColumn) {
        warningMessage = '⚠️ Could not auto-detect time columns. Please select them manually.';
      }

      step = 'mapping';
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('at least a header row')) {
          errorMessage = '❌ Invalid CSV format.\n\nThe file must contain:\n• A header row with column names\n• At least one data row';
        } else {
          errorMessage = `❌ Failed to parse CSV file.\n\nError: ${error.message}`;
        }
      } else {
        errorMessage = '❌ An unexpected error occurred while parsing the CSV file.';
      }
      console.error('CSV parse error:', error);
    }
  }

  async function parsePDF() {
    try {
      // For PDF parsing, we'll use a simple text extraction approach
      // In a real implementation, you'd want to use pdf.js or similar library
      warningMessage = '⚠️ PDF import has limited support.\n\nFor best results:\n• Export your timesheet as CSV\n• Ensure the PDF contains text (not scanned images)';
      
      // Basic implementation: Try to extract text from PDF
      // This is a placeholder - in production, you'd use a proper PDF library
      const arrayBuffer = await file!.arrayBuffer();
      
      // Simple text extraction (very basic - won't work for all PDFs)
      const textContent = await extractTextFromPDF(arrayBuffer);
      
      if (textContent.length > 0) {
        headers = textContent[0];
        parsedData = textContent.slice(1);
        
        // Auto-detect columns same as CSV
        const detected = autoDetectColumns(textContent[0]);
        if (detected.dateColumn) dateColumn = detected.dateColumn;
        if (detected.startTimeColumn) startTimeColumn = detected.startTimeColumn;
        if (detected.endTimeColumn) endTimeColumn = detected.endTimeColumn;
        
        step = 'mapping';
      } else {
        errorMessage = '❌ Could not extract data from PDF.\n\nPossible reasons:\n• The PDF is scanned (image-based)\n• The PDF does not contain table data\n• The PDF format is not supported\n\n💡 Try exporting as CSV instead.';
      }
    } catch (error) {
      errorMessage = '❌ Failed to parse PDF file.\n\n💡 Please try exporting your timesheet as CSV for better compatibility.';
      if (error instanceof Error) {
        errorMessage += `\n\nTechnical details: ${error.message}`;
      }
      console.error('PDF parse error:', error);
    }
  }

  async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string[][]> {
    // This is a simplified PDF text extraction
    // It looks for common table patterns in the PDF raw text
    const bytes = new Uint8Array(buffer);
    let text = '';
    
    // Try to extract raw text from PDF (very basic approach)
    const decoder = new TextDecoder('latin1');
    const rawText = decoder.decode(bytes);
    
    // Look for text streams in PDF
    const textMatches = rawText.match(/\(([^)]+)\)/g);
    if (textMatches) {
      text = textMatches
        .map(m => m.slice(1, -1))
        .filter(t => t.trim().length > 0)
        .join(' ');
    }

    // Try to parse table-like structure
    const lines = text.split(/[\n\r]+/).filter(l => l.trim());
    if (lines.length < 2) {
      throw new Error('Could not extract structured data from PDF');
    }

    // Simple heuristic: split by multiple spaces or tabs
    const result = lines.map(line => 
      line.split(/\s{2,}|\t/).map(cell => cell.trim()).filter(cell => cell)
    );

    return result.filter(row => row.length > 0);
  }

  function updatePreview() {
    if (!startTimeColumn || !endTimeColumn || !parsedData.length) {
      previewLogs = [];
      return;
    }

    const dateIndex = dateColumn ? headers.indexOf(dateColumn) : -1;
    const startIndex = headers.indexOf(startTimeColumn);
    const endIndex = headers.indexOf(endTimeColumn);

    previewLogs = parsedData.slice(0, 5).map(row => {
      const dateValue = dateIndex >= 0 ? row[dateIndex] || '' : '';
      const startTime = row[startIndex] || '';
      const endTime = row[endIndex] || '';
      
      const start = combineDateAndTime(dateValue, startTime);
      const end = combineDateAndTime(dateValue, endTime);
      const isValid = isValidDateTime(start) && isValidDateTime(end);
      return { start, end, isValid };
    });
  }

  $: if (startTimeColumn || endTimeColumn || dateColumn) {
    updatePreview();
  }

  function goToProjectMapping() {
    errorMessage = '';
    warningMessage = '';
    validationErrors = [];

    if (!startTimeColumn || !endTimeColumn) {
      errorMessage = '❌ Missing required columns.\n\nPlease select:\n• Start Time Column\n• End Time Column';
      return;
    }

    // Validate preview data
    const invalidCount = previewLogs.filter(log => !log.isValid).length;
    if (invalidCount > 0 && invalidCount === previewLogs.length) {
      errorMessage = '❌ All preview rows have invalid date/time values.\n\nPlease check:\n• Date column selection (if using separate date column)\n• Date/time format in your CSV\n• That dates and times are complete';
      return;
    }

    if (invalidCount > 0) {
      warningMessage = `⚠️ ${invalidCount} of ${previewLogs.length} preview rows have invalid date/time values.\n\nThese rows will be skipped during import.`;
    }

    // If project column exists, detect projects
    if (projectColumn) {
      detectedProjects = detectProjectsInCSV(parsedData, headers, projectColumn);
      
      // Initialize mappings with default values (all set to assign to first button or ignore)
      projectMappings = new Map();
      detectedProjects.forEach(project => {
        projectMappings.set(project.name, { action: 'assign' });
      });
      
      step = 'project-mapping';
    } else {
      // No project column, require button selection
      if (!selectedButtonId) {
        errorMessage = '❌ No button selected.\n\nPlease select which button/category to assign these timelogs to.';
        return;
      }
      step = 'confirm';
    }
  }

  function goToConfirm() {
    errorMessage = '';
    warningMessage = '';
    validationErrors = [];

    // Validate that all projects have proper mappings
    if (projectColumn && detectedProjects.length > 0) {
      const unmappedProjects = detectedProjects.filter(project => {
        const mapping = projectMappings.get(project.name);
        return mapping?.action === 'assign' && !mapping.buttonId;
      });

      if (unmappedProjects.length > 0) {
        errorMessage = `❌ Please assign buttons to all projects or mark them as ignore.\n\nUnmapped projects: ${unmappedProjects.map(p => p.name).join(', ')}`;
        return;
      }
    } else if (!selectedButtonId) {
      errorMessage = '❌ No button selected.\n\nPlease select which button/category to assign these timelogs to.';
      return;
    }

    step = 'confirm';
  }

  function goBackToMapping() {
    step = 'mapping';
  }

  function goBackToProjectMapping() {
    step = 'project-mapping';
  }

  function handleProjectActionChange(projectName: string, action: 'assign' | 'ignore' | 'create') {
    const mapping = projectMappings.get(projectName) || { action: 'assign' };
    
    if (action === 'create') {
      currentProjectForButton = projectName;
      showButtonForm = true;
    } else {
      mapping.action = action;
      if (action === 'ignore') {
        mapping.buttonId = undefined;
      }
      projectMappings.set(projectName, mapping);
      projectMappings = projectMappings; // Trigger reactivity
    }
  }

  function handleProjectButtonSelect(projectName: string, buttonId: string) {
    const mapping = projectMappings.get(projectName) || { action: 'assign' };
    mapping.buttonId = buttonId;
    projectMappings.set(projectName, mapping);
    projectMappings = projectMappings; // Trigger reactivity
  }

  function handleButtonFormClose() {
    // After button is created (or form closed), refresh and auto-select the newest button for the project
    if (currentProjectForButton) {
      // Get the most recently created button (last in the list after sorting)
      const sortedButtons = [...$buttonsStore.buttons].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      if (sortedButtons.length > 0) {
        const newButton = sortedButtons[0];
        const mapping = projectMappings.get(currentProjectForButton) || { action: 'assign' };
        mapping.action = 'assign';
        mapping.buttonId = newButton.id;
        projectMappings.set(currentProjectForButton, mapping);
        projectMappings = projectMappings; // Trigger reactivity
      }
    }
    
    showButtonForm = false;
    currentProjectForButton = null;
  }

  async function handleImport() {
    try {
      errorMessage = '';
      warningMessage = '';
      validationErrors = [];

      // Process rows using the lib utility
      const rows = processTimelogRows({
        data: parsedData,
        headers,
        dateColumn,
        startTimeColumn,
        endTimeColumn,
        notesColumn,
      });

      // Validate and convert using the lib utility
      const result = validateAndConvertTimelogs(rows);

      // Store all validation errors
      validationErrors = result.errors;

      if (result.valid.length === 0) {
        const totalErrors = result.errors.length;
        errorMessage = `❌ No valid timelogs found to import.\n\nFound ${totalErrors} error${totalErrors !== 1 ? 's' : ''}:\n\n` + 
          result.errors.slice(0, MAX_DISPLAYED_ERRORS).join('\n');
        
        if (totalErrors > MAX_DISPLAYED_ERRORS) {
          errorMessage += `\n\n... and ${totalErrors - MAX_DISPLAYED_ERRORS} more error${totalErrors - MAX_DISPLAYED_ERRORS !== 1 ? 's' : ''}`;
        }

        errorMessage += '\n\n💡 Common issues:\n• Invalid date/time formats\n• End time before start time\n• Missing date column (if times don\'t include dates)\n• Empty cells in time columns';
        return;
      }

      // If we have project mappings, process and dispatch with mappings
      if (projectColumn && detectedProjects.length > 0) {
        const projectIndex = headers.indexOf(projectColumn);
        
        // Build timelogs with their button assignments based on project
        const timelogsWithButtons: Array<typeof result.valid[0] & { button_id: string }> = [];
        let ignoredCount = 0;

        result.valid.forEach((timelog, index) => {
          const row = rows[index];
          const projectName = parsedData[row.rowIndex][projectIndex]?.trim() || '(empty)';
          const mapping = projectMappings.get(projectName);

          if (mapping?.action === 'ignore') {
            ignoredCount++;
            return;
          }

          const buttonId = mapping?.buttonId;
          if (!buttonId) return; // Should not happen due to validation

          timelogsWithButtons.push({
            ...timelog,
            button_id: buttonId,
          });
        });

        // Show warning if some rows were skipped or ignored
        const totalSkipped = result.errors.length + ignoredCount;
        if (totalSkipped > 0) {
          warningMessage = `⚠️ ${totalSkipped} row${totalSkipped !== 1 ? 's' : ''} will be skipped (${result.errors.length} errors, ${ignoredCount} ignored).\n\nImporting ${timelogsWithButtons.length} valid timelog${timelogsWithButtons.length !== 1 ? 's' : ''}.`;
        }

        // Dispatch single import event with timelogs that already have button_id
        dispatch('import', {
          buttonId: '', // Not used - button_id is on each timelog
          timelogs: timelogsWithButtons,
          skippedCount: totalSkipped,
          errors: result.errors,
          hasProjectMappings: true,
        });

        handleClose();
      } else {
        // No project mapping - use single button
        // Show warning if some rows were skipped
        if (result.errors.length > 0) {
          warningMessage = `⚠️ ${result.errors.length} row${result.errors.length !== 1 ? 's' : ''} will be skipped due to errors.\n\nImporting ${result.valid.length} valid timelog${result.valid.length !== 1 ? 's' : ''}.`;
        }

        dispatch('import', {
          buttonId: selectedButtonId,
          timelogs: result.valid,
          skippedCount: parsedData.length - result.valid.length,
          errors: result.errors,
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Start time and end time columns must be valid')) {
          errorMessage = '❌ Invalid column configuration.\n\nThe selected start or end time column does not exist in your CSV.';
        } else {
          errorMessage = `❌ Failed to process timelogs.\n\nError: ${error.message}`;
        }
      } else {
        errorMessage = '❌ An unexpected error occurred while processing timelogs.';
      }
      console.error('Import error:', error);
    }
  }

  function getValidLogCount(): number {
    if (!startTimeColumn || !endTimeColumn) return 0;
    
    try {
      const rows = processTimelogRows({
        data: parsedData,
        headers,
        dateColumn,
        startTimeColumn,
        endTimeColumn,
        notesColumn,
      });

      const result = validateAndConvertTimelogs(rows);
      return result.valid.length;
    } catch (error) {
      console.error('Error counting valid logs:', error);
      return 0;
    }
  }
</script>

<!-- Modal Overlay -->
<div 
  class="import-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
  on:click={handleClose}
  on:keydown={(e) => e.key === 'Escape' && handleClose()}
  role="button"
  tabindex="0"
>
  <!-- Modal Content -->
  <div 
    class="bg-white rounded-lg shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col"
    on:click|stopPropagation
    on:keydown|stopPropagation
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
      <h2 class="text-xl font-semibold text-gray-800">
        Import Timelogs{#if fileType} from {fileType.toUpperCase()}{/if}
      </h2>
      <button
        on:click={handleClose}
        class="text-gray-400 hover:text-gray-600 transition-colors icon-[si--close-circle-duotone]"
        style="width: 28px; height: 28px;"
        aria-label="Close"
      ></button>
    </div>

    <!-- Progress Steps -->
    <div class="px-6 py-3 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center justify-center gap-2">
        <div class="flex items-center gap-2">
          <span 
            class="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium text-white"
            class:bg-blue-500={step === 'upload'}
            class:bg-green-500={step !== 'upload'}
          >1</span>
          <span class="text-sm" class:font-medium={step === 'upload'}>Upload</span>
        </div>
        <div class="w-6 h-0.5 bg-gray-300"></div>
        <div class="flex items-center gap-2">
          <span 
            class="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium"
            class:bg-blue-500={step === 'mapping'}
            class:bg-green-500={step === 'project-mapping' || step === 'confirm'}
            class:bg-gray-300={step === 'upload'}
            class:text-white={step !== 'upload'}
            class:text-gray-600={step === 'upload'}
          >2</span>
          <span class="text-sm" class:font-medium={step === 'mapping'}>Columns</span>
        </div>
        {#if projectColumn}
          <div class="w-6 h-0.5 bg-gray-300"></div>
          <div class="flex items-center gap-2">
            <span 
              class="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium"
              class:bg-blue-500={step === 'project-mapping'}
              class:bg-green-500={step === 'confirm'}
              class:bg-gray-300={step === 'upload' || step === 'mapping'}
              class:text-white={step === 'project-mapping' || step === 'confirm'}
              class:text-gray-600={step === 'upload' || step === 'mapping'}
            >3</span>
            <span class="text-sm" class:font-medium={step === 'project-mapping'}>Projects</span>
          </div>
        {/if}
        <div class="w-6 h-0.5 bg-gray-300"></div>
        <div class="flex items-center gap-2">
          <span 
            class="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium"
            class:bg-blue-500={step === 'confirm'}
            class:bg-gray-300={step !== 'confirm'}
            class:text-white={step === 'confirm'}
            class:text-gray-600={step !== 'confirm'}
          >{projectColumn ? '4' : '3'}</span>
          <span class="text-sm" class:font-medium={step === 'confirm'}>Confirm</span>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="overflow-y-auto flex-1 p-6">
      {#if step === 'upload'}
        <!-- File Upload Step -->
        <div
          class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
          on:drop={handleDrop}
          on:dragover={handleDragOver}
          on:click={() => fileInput.click()}
          on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
          role="button"
          tabindex="0"
        >
          <input
            bind:this={fileInput}
            type="file"
            accept=".csv,text/csv,.pdf,application/pdf"
            on:change={handleFileSelect}
            class="hidden"
          />
          <span class="icon-[si--file-upload-duotone] text-gray-400 mx-auto mb-4" style="width: 48px; height: 48px;"></span>
          <p class="text-gray-600 mb-2">
            {#if file}
              Selected: <span class="font-medium">{file.name}</span>
            {:else}
              Drag and drop your CSV or PDF file here
            {/if}
          </p>
          <p class="text-sm text-gray-500">or click to browse</p>
        </div>

        {#if errorMessage}
          <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm whitespace-pre-line">
            {errorMessage}
          </div>
        {/if}

        {#if warningMessage}
          <div class="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm whitespace-pre-line">
            {warningMessage}
          </div>
        {/if}

        <div class="mt-6 flex justify-end gap-3">
          <button
            on:click={handleClose}
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            on:click={parseFile}
            disabled={!file}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>

      {:else if step === 'mapping'}
        <!-- Column Mapping Step -->
        <div class="space-y-4">
          <div>
            <label for="date-column" class="block text-sm font-medium text-gray-700 mb-1">
              Date Column (optional)
            </label>
            <select
              id="date-column"
              bind:value={dateColumn}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">None (times include dates)</option>
              {#each headers as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
            <p class="text-xs text-gray-500 mt-1">
              Select if your start/end times don't include the date
            </p>
          </div>

          <div>
            <label for="start-column" class="block text-sm font-medium text-gray-700 mb-1">
              Start Time Column *
            </label>
            <select
              id="start-column"
              bind:value={startTimeColumn}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select column...</option>
              {#each headers as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="end-column" class="block text-sm font-medium text-gray-700 mb-1">
              End Time Column *
            </label>
            <select
              id="end-column"
              bind:value={endTimeColumn}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select column...</option>
              {#each headers as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="notes-column" class="block text-sm font-medium text-gray-700 mb-1">
              Notes/Description Column (optional)
            </label>
            <select
              id="notes-column"
              bind:value={notesColumn}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">None</option>
              {#each headers as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
            <p class="text-xs text-gray-500 mt-1">
              Select to import notes or descriptions for each timelog
            </p>
          </div>

          <div>
            <label for="project-column" class="block text-sm font-medium text-gray-700 mb-1">
              Project Column (optional)
            </label>
            <select
              id="project-column"
              bind:value={projectColumn}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">None (assign all to one button)</option>
              {#each headers as header}
                <option value={header}>{header}</option>
              {/each}
            </select>
            <p class="text-xs text-gray-500 mt-1">
              Select if your CSV has different projects to map to different buttons
            </p>
          </div>

          {#if !projectColumn}
            <div>
              <label for="button-select" class="block text-sm font-medium text-gray-700 mb-1">
                Assign to Button *
              </label>
              <select
                id="button-select"
                bind:value={selectedButtonId}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a button...</option>
                {#each buttons as button}
                  <option value={button.id}>
                    {button.emoji ? button.emoji + ' ' : ''}{button.name}
                  </option>
                {/each}
              </select>
            </div>
          {/if}

          {#if previewLogs.length > 0}
            <div class="mt-4">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-medium text-gray-700">Preview (first 5 rows):</h3>
                <span class="text-xs text-gray-500">
                  {previewLogs.filter(l => l.isValid).length} / {previewLogs.length} valid
                </span>
              </div>
              <div class="bg-gray-50 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                {#each previewLogs as log, index}
                  <div 
                    class="flex items-start gap-2 text-sm p-2 rounded"
                    class:bg-green-50={log.isValid}
                    class:text-green-700={log.isValid}
                    class:bg-red-50={!log.isValid}
                    class:text-red-600={!log.isValid}
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
            <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm whitespace-pre-line">
              {errorMessage}
            </div>
          {/if}

          {#if warningMessage}
            <div class="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm whitespace-pre-line">
              {warningMessage}
            </div>
          {/if}

          <div class="mt-6 flex justify-end gap-3">
            <button
              on:click={handleClose}
              class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              on:click={goToProjectMapping}
              disabled={!startTimeColumn || !endTimeColumn || (!projectColumn && !selectedButtonId)}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>

      {:else if step === 'project-mapping'}
        <!-- Project Mapping Step -->
        <div class="space-y-4">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 class="text-sm font-medium text-blue-800 mb-1">Map Projects to Buttons</h3>
            <p class="text-sm text-blue-700">
              Found {detectedProjects.length} project{detectedProjects.length !== 1 ? 's' : ''} in your CSV.
              Choose how to handle each one:
            </p>
          </div>

          <div class="space-y-3 max-h-96 overflow-y-auto">
            {#each detectedProjects as project}
              {@const mapping = projectMappings.get(project.name) || { action: 'assign' }}
              <div class="border border-gray-200 rounded-lg p-4 bg-white">
                <div class="flex items-start justify-between mb-3">
                  <div>
                    <h4 class="font-medium text-gray-800">{project.name}</h4>
                    <p class="text-sm text-gray-500">{project.count} timelog{project.count !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                <div class="space-y-2">
                  <div class="block text-sm font-medium text-gray-700 mb-2">Action:</div>
                  <div class="flex gap-2">
                    <label class="flex-1">
                      <input
                        type="radio"
                        name="action-{project.name}"
                        value="assign"
                        checked={mapping.action === 'assign'}
                        on:change={() => handleProjectActionChange(project.name, 'assign')}
                        class="sr-only peer"
                      />
                      <div class="px-3 py-2 border border-gray-300 rounded-lg cursor-pointer text-center text-sm peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 hover:bg-gray-50">
                        Assign to Button
                      </div>
                    </label>
                    <label class="flex-1">
                      <input
                        type="radio"
                        name="action-{project.name}"
                        value="create"
                        checked={mapping.action === 'create'}
                        on:change={() => handleProjectActionChange(project.name, 'create')}
                        class="sr-only peer"
                      />
                      <div class="px-3 py-2 border border-gray-300 rounded-lg cursor-pointer text-center text-sm peer-checked:border-green-500 peer-checked:bg-green-50 peer-checked:text-green-700 hover:bg-gray-50">
                        Create Button
                      </div>
                    </label>
                    <label class="flex-1">
                      <input
                        type="radio"
                        name="action-{project.name}"
                        value="ignore"
                        checked={mapping.action === 'ignore'}
                        on:change={() => handleProjectActionChange(project.name, 'ignore')}
                        class="sr-only peer"
                      />
                      <div class="px-3 py-2 border border-gray-300 rounded-lg cursor-pointer text-center text-sm peer-checked:border-gray-500 peer-checked:bg-gray-100 peer-checked:text-gray-700 hover:bg-gray-50">
                        Ignore
                      </div>
                    </label>
                  </div>

                  {#if mapping.action === 'assign'}
                    <select
                      bind:value={mapping.buttonId}
                      on:change={(e) => handleProjectButtonSelect(project.name, e.currentTarget.value)}
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">Select a button...</option>
                      {#each buttons as button}
                        <option value={button.id}>
                          {button.emoji ? button.emoji + ' ' : ''}{button.name}
                        </option>
                      {/each}
                    </select>
                  {/if}
                </div>
              </div>
            {/each}
          </div>

          {#if errorMessage}
            <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm whitespace-pre-line">
              {errorMessage}
            </div>
          {/if}

          {#if warningMessage}
            <div class="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm whitespace-pre-line">
              {warningMessage}
            </div>
          {/if}

          <div class="mt-6 flex justify-end gap-3">
            <button
              on:click={goBackToMapping}
              class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              on:click={goToConfirm}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>

      {:else if step === 'confirm'}
        <!-- Confirmation Step -->
        <div class="space-y-4">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 class="text-lg font-medium text-blue-800 mb-2">Ready to Import</h3>
            {#if projectColumn && detectedProjects.length > 0}
              {@const ignoredProjects = detectedProjects.filter(p => projectMappings.get(p.name)?.action === 'ignore')}
              {@const ignoredCount = ignoredProjects.reduce((sum, p) => sum + p.count, 0)}
              <p class="text-blue-700">
                <strong>{getValidLogCount() - ignoredCount}</strong> timelogs will be imported from {detectedProjects.length - ignoredProjects.length} project{detectedProjects.length - ignoredProjects.length !== 1 ? 's' : ''}
              </p>
              {#if ignoredCount > 0}
                <p class="text-amber-700 mt-2">
                  ⚠️ {ignoredCount} timelog{ignoredCount !== 1 ? 's' : ''} from {ignoredProjects.length} ignored project{ignoredProjects.length !== 1 ? 's' : ''} will be skipped
                </p>
              {/if}
            {:else}
              <p class="text-blue-700">
                <strong>{getValidLogCount()}</strong> timelogs will be imported and assigned to:
              </p>
              <p class="text-blue-800 font-medium mt-1">
                {#each buttons.filter(b => b.id === selectedButtonId) as button}
                  {button.emoji ? button.emoji + ' ' : ''}{button.name}
                {/each}
              </p>
            {/if}
            {#if parsedData.length - getValidLogCount() > 0}
              <p class="text-amber-700 mt-2">
                ⚠️ {parsedData.length - getValidLogCount()} rows will be skipped due to invalid data
              </p>
            {/if}
          </div>

          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Column Mapping:</h4>
            <ul class="text-sm text-gray-600 space-y-1">
              {#if dateColumn}
                <li>Date: <span class="font-medium">{dateColumn}</span></li>
              {/if}
              <li>Start Time: <span class="font-medium">{startTimeColumn}</span></li>
              <li>End Time: <span class="font-medium">{endTimeColumn}</span></li>
              {#if notesColumn}
                <li>Notes: <span class="font-medium">{notesColumn}</span></li>
              {/if}
              {#if projectColumn}
                <li>Project: <span class="font-medium">{projectColumn}</span></li>
              {/if}
            </ul>
          </div>

          {#if projectColumn && detectedProjects.length > 0}
            <div class="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
              <h4 class="text-sm font-medium text-gray-700 mb-2">Project Mappings:</h4>
              <ul class="text-sm text-gray-600 space-y-2">
                {#each detectedProjects as project}
                  {@const mapping = projectMappings.get(project.name)}
                  {#if mapping?.action !== 'ignore'}
                    {@const button = buttons.find(b => b.id === mapping?.buttonId)}
                    <li class="flex items-center justify-between py-1 border-b border-gray-200 last:border-0">
                      <span class="font-medium">{project.name}</span>
                      <span class="text-gray-500">
                        → {button?.emoji ? button.emoji + ' ' : ''}{button?.name || 'Unknown'}
                        <span class="text-xs ml-1">({project.count})</span>
                      </span>
                    </li>
                  {/if}
                {/each}
              </ul>
            </div>
          {/if}

          {#if errorMessage}
            <div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm whitespace-pre-line">
              {errorMessage}
            </div>
          {/if}

          {#if warningMessage}
            <div class="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm whitespace-pre-line">
              {warningMessage}
            </div>
          {/if}

          {#if validationErrors.length > 0}
            <details class="bg-gray-50 rounded-lg border border-gray-200">
              <summary class="p-3 cursor-pointer hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2">
                <span class="icon-[si--warning-triangle-line] text-amber-600" style="width: 16px; height: 16px;"></span>
                View {validationErrors.length} validation error{validationErrors.length !== 1 ? 's' : ''}
              </summary>
              <div class="p-3 pt-0 max-h-48 overflow-y-auto">
                <ul class="space-y-1 text-xs text-gray-600">
                  {#each validationErrors as error}
                    <li class="py-1 border-b border-gray-200 last:border-0">{error}</li>
                  {/each}
                </ul>
              </div>
            </details>
          {/if}

          <div class="mt-6 flex justify-end gap-3">
            <button
              on:click={projectColumn ? goBackToProjectMapping : goBackToMapping}
              class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              on:click={handleImport}
              disabled={getValidLogCount() === 0}
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Import {getValidLogCount()} Timelogs
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showButtonForm}
  <ButtonForm on:close={handleButtonFormClose} />
{/if}

<style>
  /* Add backdrop blur effect to modal overlay */
  .import-modal-backdrop {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
