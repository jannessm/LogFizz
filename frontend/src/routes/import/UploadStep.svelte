<script lang="ts">
  let {
    file,
    errorMessage,
    warningMessage,
    onFileSelect,
    onContinue,
    onCancel,
  }: {
    file: File | null;
    errorMessage: string;
    warningMessage: string;
    onFileSelect: (file: File) => void;
    onContinue: () => void;
    onCancel: () => void;
  } = $props();

  let fileInput = $state<HTMLInputElement>();

  function detectFileType(fileName: string): 'csv' | null {
    const extension = fileName.toLowerCase().split('.').pop();
    if (extension === 'csv') return 'csv';
    return null;
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const selectedFile = input.files[0];
      const detectedType = detectFileType(selectedFile.name);
      
      if (!detectedType) {
        return;
      }
      
      onFileSelect(selectedFile);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const droppedFile = event.dataTransfer.files[0];
      const detectedType = detectFileType(droppedFile.name);
      
      if (!detectedType) {
        return;
      }
      
      onFileSelect(droppedFile);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
  <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Upload CSV File</h2>
  
  <div
    class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-400 dark:hover:border-orange-400 transition-colors cursor-pointer"
    ondrop={handleDrop}
    ondragover={handleDragOver}
    onclick={() => fileInput?.click()}
    onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
    role="button"
    tabindex="0"
  >
    <input
      bind:this={fileInput}
      type="file"
      accept=".csv,text/csv"
      onchange={handleFileSelect}
      class="hidden"
    />
    <span class="icon-[si--file-download-duotone] text-gray-400 dark:text-gray-500 mx-auto mb-4" style="width: 48px; height: 48px;"></span>
    <p class="text-gray-600 dark:text-gray-300 mb-2">
      {#if file}
        Selected: <span class="font-medium">{file.name}</span>
      {:else}
        Drag and drop your CSV file here
      {/if}
    </p>
    <p class="text-sm text-gray-500 dark:text-gray-400">or click to browse</p>
  </div>

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
      onclick={onCancel}
      class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      Cancel
    </button>
    <button
      onclick={onContinue}
      disabled={!file}
      class="px-4 py-2 bg-blue-600 dark:bg-orange-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-orange-600 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
    >
      Continue
    </button>
  </div>
</div>
