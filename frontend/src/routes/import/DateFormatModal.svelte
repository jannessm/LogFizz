<script lang="ts">
  import Modal from '../../components/Modal.svelte';
  import { DATE_TIME_FORMATS } from '../../../../lib/utils/csvImport.js';
  import { dayjs } from '../../types';
  import { _ } from '../../lib/i18n';

  let {
    sampleValue,
    timezone,
    onFormatSelected,
    onClose,
  }: {
    sampleValue: string;
    timezone: string;
    onFormatSelected: (format: string) => void;
    onClose: () => void;
  } = $props();

  let selectedFormat = $state('');
  let customFormat = $state('');
  let testResult = $state<{ success: boolean; message: string } | null>(null);

  // Generate localized formats for the timezone
  // Using actual format patterns instead of locale tokens for reliable parsing
  const localizedFormats = $derived.by(() => {
    const now = dayjs().tz(timezone);
    return [
      { 
        label: $_('import.shortDateTimeFormat') + ' (MM/DD/YYYY h:mm A)', 
        example: now.format('MM/DD/YYYY h:mm A'), 
        format: 'MM/DD/YYYY h:mm A' 
      },
      { 
        label: $_('import.europeanDateTimeFormat') + ' (DD/MM/YYYY HH:mm)', 
        example: now.format('DD/MM/YYYY HH:mm'), 
        format: 'DD/MM/YYYY HH:mm' 
      },
      { 
        label: $_('import.isoDateTimeFormat') + ' (YYYY-MM-DD HH:mm)', 
        example: now.format('YYYY-MM-DD HH:mm'), 
        format: 'YYYY-MM-DD HH:mm' 
      },
      { 
        label: $_('import.longDateTimeFormat') + ' (MMMM D, YYYY h:mm A)', 
        example: now.format('MMMM D, YYYY h:mm A'), 
        format: 'MMMM D, YYYY h:mm A' 
      },
    ];
  });

  function handleSelectFormat(format: string) {
    selectedFormat = format;
    testResult = null; // Clear test result when selecting a format
  }

  function handleApply() {
    const formatToUse = selectedFormat || customFormat;
    if (formatToUse) {
      onFormatSelected(formatToUse);
    }
  }

  function handleTestCustomFormat() {
    if (!customFormat) return;
    
    try {
      const parsed = dayjs(sampleValue, customFormat, true);
      if (parsed.isValid()) {
        selectedFormat = '';
        testResult = {
          success: true,
          message: $_('import.validParsed') + `: ${parsed.format('YYYY-MM-DD HH:mm:ss')}`
        };
        return true;
      } else {
        testResult = {
          success: false,
          message: $_('import.invalidFormat') + ': ' + $_('import.formatDoesNotMatchSample')
        };
        return false;
      }
    } catch (e) {
      testResult = {
        success: false,
        message: $_('import.error') + `: ${e instanceof Error ? e.message : $_('import.invalidFormatSyntax')}`
      };
      return false;
    }
  }
</script>

<Modal title={$_('import.dateFormatNotRecognized')} onclose={onClose} maxWidth="max-w-2xl">
  {#snippet children()}
    <div class="space-y-4">
      <div class="bg-amber-50 dark:bg-amber-900 dark:bg-opacity-20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p class="text-sm text-amber-800 dark:text-amber-200">
          <strong>{$_('import.unableToParse')}</strong> <code class="bg-white dark:bg-gray-700 px-2 py-1 rounded">{sampleValue}</code>
        </p>
        <p class="text-xs text-amber-700 dark:text-amber-300 mt-2">
          {$_('import.selectCorrectFormat')}
        </p>
      </div>

      <!-- Format Selection -->
      <div class="space-y-3">
        <h3 class="font-medium text-gray-800 dark:text-gray-200">{$_('import.localizedFormats')} ({$_('import.for')} {timezone})</h3>
        <div class="space-y-2">
          {#each localizedFormats as { label, example, format }}
            <button
              onclick={() => handleSelectFormat(format)}
              class="w-full text-left p-3 rounded-lg border transition-colors"
              class:border-blue-500={selectedFormat === format}
              class:dark:border-orange-500={selectedFormat === format}
              class:bg-blue-50={selectedFormat === format}
              class:border-gray-200={selectedFormat !== format}
              class:dark:border-gray-600={selectedFormat !== format}
              class:hover:bg-gray-50={selectedFormat !== format}
              class:dark:hover:bg-gray-700={selectedFormat !== format}
            >
              <div class="flex justify-between items-start">
                <div>
                  <div class="font-medium text-sm text-gray-800 dark:text-gray-200">{label}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">{$_('import.format')}: {format}</div>
                </div>
                <div class="text-xs text-gray-600 dark:text-gray-400 font-mono">{example}</div>
              </div>
            </button>
          {/each}
        </div>
      </div>

      <div class="space-y-3">
        <h3 class="font-medium text-gray-800 dark:text-gray-200">{$_('import.standardFormats')}</h3>
        <div class="max-h-60 overflow-y-auto space-y-2 pr-2">
          {#each DATE_TIME_FORMATS as format}
            {@const exampleDate = dayjs('2025-01-15 14:30:00')}
            <button
              onclick={() => handleSelectFormat(format)}
              class="w-full text-left p-3 rounded-lg border transition-colors"
              class:border-blue-500={selectedFormat === format}
              class:dark:border-orange-500={selectedFormat === format}
              class:bg-blue-50={selectedFormat === format}
              class:border-gray-200={selectedFormat !== format}
              class:dark:border-gray-600={selectedFormat !== format}
              class:hover:bg-gray-50={selectedFormat !== format}
              class:dark:hover:bg-gray-700={selectedFormat !== format}
            >
              <div class="flex justify-between items-start">
                <div class="font-mono text-sm text-gray-800 dark:text-gray-200">{format}</div>
                <div class="text-xs text-gray-600 dark:text-gray-400 font-mono">{exampleDate.format(format)}</div>
              </div>
            </button>
          {/each}
        </div>
      </div>

      <!-- Custom Format -->
      <div class="space-y-2 border-t border-gray-200 dark:border-gray-600 pt-4">
        <label for="custom-format" class="block font-medium text-gray-800 dark:text-gray-200">
          {$_('import.customFormat')}
        </label>
        <div class="flex gap-2">
          <input
            id="custom-format"
            type="text"
            bind:value={customFormat}
            placeholder="e.g., DD.MM.YYYY HH:mm"
            class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            oninput={() => { selectedFormat = ''; testResult = null; }}
          />
          <button
            onclick={handleTestCustomFormat}
            disabled={!customFormat}
            class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {$_('import.test')}
          </button>
        </div>
        
        {#if testResult}
          <div class="p-3 rounded-lg text-sm border" 
            class:bg-green-50={testResult.success}
            class:dark:bg-green-900={testResult.success}
            class:border-green-200={testResult.success}
            class:dark:border-green-800={testResult.success}
            class:text-green-800={testResult.success}
            class:dark:text-green-200={testResult.success}
            class:bg-red-50={!testResult.success}
            class:dark:bg-red-900={!testResult.success}
            class:border-red-200={!testResult.success}
            class:dark:border-red-800={!testResult.success}
            class:text-red-800={!testResult.success}
            class:dark:text-red-200={!testResult.success}
          >
            {testResult.message}
          </div>
        {/if}
        
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {$_('import.formatHelp')} <a href="https://day.js.org/docs/en/parse/string-format" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-orange-400 hover:underline">{$_('import.dayjsDocumentation')}</a> {$_('import.forDetails')}
        </p>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex justify-end gap-3">
      <button
        onclick={onClose}
        class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        {$_('common.cancel')}
      </button>
      <button
        onclick={handleApply}
        disabled={!selectedFormat && !customFormat}
        class="px-4 py-2 bg-blue-600 dark:bg-orange-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-orange-600 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        {$_('import.applyFormat')}
      </button>
    </div>
  {/snippet}
</Modal>
