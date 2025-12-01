<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import dayjs from 'dayjs';
  import { buttonsStore } from '../../stores/buttons';

  const dispatch = createEventDispatcher();

  // Constants
  const DATE_TIME_FORMATS = [
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DD HH:mm',
    'DD.MM.YYYY HH:mm:ss',
    'DD.MM.YYYY HH:mm',
    'DD/MM/YYYY HH:mm:ss',
    'DD/MM/YYYY HH:mm',
    'MM/DD/YYYY HH:mm:ss',
    'MM/DD/YYYY HH:mm',
    'YYYY-MM-DDTHH:mm:ss',
    'YYYY-MM-DDTHH:mm',
  ];
  const MAX_DISPLAYED_ERRORS = 5;

  let file: File | null = null;
  let fileType: 'csv' | 'pdf' | null = null;
  let fileInput: HTMLInputElement;
  let step: 'upload' | 'mapping' | 'confirm' = 'upload';
  let parsedData: string[][] = [];
  let headers: string[] = [];
  let startTimeColumn: string = '';
  let endTimeColumn: string = '';
  let selectedButtonId: string = '';
  let previewLogs: { start: string; end: string; isValid: boolean }[] = [];
  let errorMessage: string = '';

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
        errorMessage = 'Please upload a CSV or PDF file';
        file = null;
        fileType = null;
        return;
      }
      
      file = selectedFile;
      fileType = detectedType;
      errorMessage = '';
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const droppedFile = event.dataTransfer.files[0];
      const detectedType = detectFileType(droppedFile.name);
      
      if (!detectedType) {
        errorMessage = 'Please upload a CSV or PDF file';
        file = null;
        fileType = null;
        return;
      }
      
      file = droppedFile;
      fileType = detectedType;
      errorMessage = '';
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  async function parseFile() {
    if (!file) return;

    errorMessage = '';
    
    if (fileType === 'csv') {
      await parseCSV();
    } else {
      await parsePDF();
    }
  }

  async function parseCSV() {
    try {
      const text = await file!.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        errorMessage = 'CSV file must have at least a header row and one data row';
        return;
      }

      // Detect delimiter from header row (prefer comma, fallback to semicolon)
      const headerLine = lines[0];
      const commaCount = (headerLine.match(/,/g) || []).length;
      const semicolonCount = (headerLine.match(/;/g) || []).length;
      const delimiter = semicolonCount > commaCount ? ';' : ',';

      // Parse CSV considering quoted fields with detected delimiter
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      headers = parseCSVLine(lines[0]);
      parsedData = lines.slice(1).map(line => parseCSVLine(line));

      // Try to auto-detect time columns
      const timePatterns = ['start', 'begin', 'from', 'anfang'];
      const endPatterns = ['end', 'stop', 'to', 'ende', 'bis'];
      
      for (const header of headers) {
        const lowerHeader = header.toLowerCase();
        if (!startTimeColumn && timePatterns.some(p => lowerHeader.includes(p))) {
          startTimeColumn = header;
        }
        if (!endTimeColumn && endPatterns.some(p => lowerHeader.includes(p))) {
          endTimeColumn = header;
        }
      }

      step = 'mapping';
    } catch (error) {
      errorMessage = 'Failed to parse CSV file';
      console.error('CSV parse error:', error);
    }
  }

  async function parsePDF() {
    try {
      // For PDF parsing, we'll use a simple text extraction approach
      // In a real implementation, you'd want to use pdf.js or similar library
      errorMessage = 'PDF import is currently only supported for CSV-like structured PDFs. Please export your data as CSV first, or contact support for PDF import assistance.';
      
      // Basic implementation: Try to extract text from PDF
      // This is a placeholder - in production, you'd use a proper PDF library
      const arrayBuffer = await file!.arrayBuffer();
      
      // Simple text extraction (very basic - won't work for all PDFs)
      const textContent = await extractTextFromPDF(arrayBuffer);
      
      if (textContent.length > 0) {
        headers = textContent[0];
        parsedData = textContent.slice(1);
        
        // Auto-detect columns same as CSV
        const timePatterns = ['start', 'begin', 'from', 'anfang'];
        const endPatterns = ['end', 'stop', 'to', 'ende', 'bis'];
        
        for (const header of headers) {
          const lowerHeader = header.toLowerCase();
          if (!startTimeColumn && timePatterns.some(p => lowerHeader.includes(p))) {
            startTimeColumn = header;
          }
          if (!endTimeColumn && endPatterns.some(p => lowerHeader.includes(p))) {
            endTimeColumn = header;
          }
        }
        
        errorMessage = '';
        step = 'mapping';
      }
    } catch (error) {
      errorMessage = 'Failed to parse PDF file. Please try exporting as CSV instead.';
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

    const startIndex = headers.indexOf(startTimeColumn);
    const endIndex = headers.indexOf(endTimeColumn);

    previewLogs = parsedData.slice(0, 5).map(row => {
      const start = row[startIndex] || '';
      const end = row[endIndex] || '';
      const isValid = isValidDateTime(start) && isValidDateTime(end);
      return { start, end, isValid };
    });
  }

  function isValidDateTime(value: string): boolean {
    if (!value) return false;
    
    for (const format of DATE_TIME_FORMATS) {
      const parsed = dayjs(value, format, true);
      if (parsed.isValid()) return true;
    }

    // Also try native Date parsing
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  function parseDateTime(value: string): dayjs.Dayjs | null {
    if (!value) return null;

    for (const format of DATE_TIME_FORMATS) {
      const parsed = dayjs(value, format, true);
      if (parsed.isValid()) return parsed;
    }

    // Try native Date parsing
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return dayjs(date);
    }

    return null;
  }

  $: if (startTimeColumn && endTimeColumn) {
    updatePreview();
  }

  function goToConfirm() {
    if (!startTimeColumn || !endTimeColumn) {
      errorMessage = 'Please select both start and end time columns';
      return;
    }
    if (!selectedButtonId) {
      errorMessage = 'Please select a button to assign the timelogs to';
      return;
    }
    errorMessage = '';
    step = 'confirm';
  }

  function goBackToMapping() {
    step = 'mapping';
  }

  async function handleImport() {
    const startIndex = headers.indexOf(startTimeColumn);
    const endIndex = headers.indexOf(endTimeColumn);
    
    const logsToImport: { start_timestamp: string; end_timestamp: string }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      const startValue = row[startIndex];
      const endValue = row[endIndex];

      const startDate = parseDateTime(startValue);
      const endDate = parseDateTime(endValue);

      if (startDate && endDate) {
        if (endDate.isAfter(startDate)) {
          logsToImport.push({
            start_timestamp: startDate.toISOString(),
            end_timestamp: endDate.toISOString(),
          });
        } else {
          errors.push(`Row ${i + 2}: End time is before start time`);
        }
      } else {
        if (!startDate) errors.push(`Row ${i + 2}: Invalid start time "${startValue}"`);
        if (!endDate) errors.push(`Row ${i + 2}: Invalid end time "${endValue}"`);
      }
    }

    if (logsToImport.length === 0) {
      errorMessage = 'No valid timelogs found to import.\n' + errors.slice(0, MAX_DISPLAYED_ERRORS).join('\n');
      return;
    }

    dispatch('import', {
      buttonId: selectedButtonId,
      timelogs: logsToImport,
      skippedCount: parsedData.length - logsToImport.length,
    });
  }

  function getValidLogCount(): number {
    if (!startTimeColumn || !endTimeColumn) return 0;
    
    const startIndex = headers.indexOf(startTimeColumn);
    const endIndex = headers.indexOf(endTimeColumn);
    
    return parsedData.filter(row => {
      const startDate = parseDateTime(row[startIndex]);
      const endDate = parseDateTime(row[endIndex]);
      return startDate && endDate && endDate.isAfter(startDate);
    }).length;
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
      <div class="flex items-center justify-center gap-4">
        <div class="flex items-center gap-2">
          <span 
            class="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium text-white"
            class:bg-blue-500={step === 'upload'}
            class:bg-green-500={step !== 'upload'}
          >1</span>
          <span class="text-sm" class:font-medium={step === 'upload'}>Upload</span>
        </div>
        <div class="w-8 h-0.5 bg-gray-300"></div>
        <div class="flex items-center gap-2">
          <span 
            class="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium"
            class:bg-blue-500={step === 'mapping'}
            class:bg-green-500={step === 'confirm'}
            class:bg-gray-300={step === 'upload'}
            class:text-white={step !== 'upload'}
            class:text-gray-600={step === 'upload'}
          >2</span>
          <span class="text-sm" class:font-medium={step === 'mapping'}>Map Columns</span>
        </div>
        <div class="w-8 h-0.5 bg-gray-300"></div>
        <div class="flex items-center gap-2">
          <span 
            class="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium"
            class:bg-blue-500={step === 'confirm'}
            class:bg-gray-300={step !== 'confirm'}
            class:text-white={step === 'confirm'}
            class:text-gray-600={step !== 'confirm'}
          >3</span>
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
          <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessage}
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

          {#if previewLogs.length > 0}
            <div class="mt-4">
              <h3 class="text-sm font-medium text-gray-700 mb-2">Preview (first 5 rows):</h3>
              <div class="bg-gray-50 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                {#each previewLogs as log, index}
                  <div 
                    class="flex items-center gap-2 text-sm"
                    class:text-green-700={log.isValid}
                    class:text-red-600={!log.isValid}
                  >
                    <span class="w-4 h-4" 
                      class:icon-[si--check-line]={log.isValid}
                      class:icon-[si--close-line]={!log.isValid}
                    ></span>
                    <span>{log.start} → {log.end}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if errorMessage}
            <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm whitespace-pre-line">
              {errorMessage}
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
              on:click={goToConfirm}
              disabled={!startTimeColumn || !endTimeColumn || !selectedButtonId}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
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
            <p class="text-blue-700">
              <strong>{getValidLogCount()}</strong> timelogs will be imported and assigned to:
            </p>
            <p class="text-blue-800 font-medium mt-1">
              {#each buttons.filter(b => b.id === selectedButtonId) as button}
                {button.emoji ? button.emoji + ' ' : ''}{button.name}
              {/each}
            </p>
            {#if parsedData.length - getValidLogCount() > 0}
              <p class="text-amber-700 mt-2">
                ⚠️ {parsedData.length - getValidLogCount()} rows will be skipped due to invalid data
              </p>
            {/if}
          </div>

          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Column Mapping:</h4>
            <ul class="text-sm text-gray-600 space-y-1">
              <li>Start Time: <span class="font-medium">{startTimeColumn}</span></li>
              <li>End Time: <span class="font-medium">{endTimeColumn}</span></li>
            </ul>
          </div>

          {#if errorMessage}
            <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm whitespace-pre-line">
              {errorMessage}
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

<style>
  /* Add backdrop blur effect to modal overlay */
  .import-modal-backdrop {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
