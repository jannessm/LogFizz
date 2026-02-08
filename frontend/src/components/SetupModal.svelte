<script lang="ts">
  import Modal from './Modal.svelte';
  import { _, setLocale } from '../lib/i18n';
  import { setDayjsLocale } from '../lib/dateFormatting';
  import { userSettingsStore } from '../stores/userSettings';
  import { saveSetting } from '../lib/db';
  import { dayjs } from '../types';

  let {
    oncomplete
  }: {
    oncomplete: () => void;
  } = $props();

  let language: 'en' | 'de' = $state('en');
  let locale: string = $state('en-US');
  let isSubmitting = $state(false);

  // Available locales with examples
  let localeOptions: { value: string; label: string }[] = $state([]);
  $effect(() => {
    // Update locale options with translated labels
    localeOptions = [
      { value: 'en-US', label: $_('settings.dateEnglishUS') },
      { value: 'en-GB', label: $_('settings.dateEnglishUK') },
      { value: 'de-DE', label: $_('settings.dateGerman') },
    ];
  });

  let dateExample = $derived(
    locale ? dayjs().locale(locale.split('-')[0]).format('LL - L - LT') : ''
  );

  async function handleSubmit() {
    if (isSubmitting) return;
    
    isSubmitting = true;
    try {
      // Update user settings
      await userSettingsStore.updateSettings({ language, locale });
      
      // Update i18n locale
      setLocale(language);
      
      // Update dayjs locale for date formatting
      setDayjsLocale(locale);
      
      // Mark setup as complete
      await saveSetting('setupComplete', true);
      
      // Call the oncomplete callback
      oncomplete();
    } catch (error) {
      console.error('Failed to save setup settings:', error);
    } finally {
      isSubmitting = false;
    }
  }

  function handleLanguageChange() {
    // When language changes, also set locale to match for a better UX
    setLocale(language);
    if (language === 'de') {
      locale = 'de-DE';
    } else {
      locale = 'en-US';
    }
  }
</script>

<Modal
  title={$_('setup.title')}
  showCloseButton={false}
  maxWidth="max-w-md"
>
  <div class="space-y-6">
    <p class="text-gray-600 dark:text-gray-400">
      {$_('setup.description')}
    </p>

    <!-- Language Selection -->
    <div>
      <label for="setup-language" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {$_('setup.language')}
      </label>
      <select
        id="setup-language"
        bind:value={language}
        onchange={handleLanguageChange}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      >
        <option value="en">{$_('settings.languageEnglish')}</option>
        <option value="de">{$_('settings.languageGerman')}</option>
      </select>
    </div>

    <!-- Locale/Date Format Selection -->
    <div>
      <label for="setup-locale" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {$_('setup.dateFormat')}
      </label>
      <select
        id="setup-locale"
        bind:value={locale}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      >
        {#each localeOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
      {#if dateExample}
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {dateExample}
        </p>
      {/if}
    </div>
  </div>

  {#snippet footer()}
    <button
      onclick={handleSubmit}
      disabled={isSubmitting}
      class="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {#if isSubmitting}
        <span class="w-5 h-5 icon-[svg-spinners--3-dots-fade]"></span>
      {:else}
        <span class="w-5 h-5 icon-[si--check-line]"></span>
      {/if}
      {$_('setup.getStarted')}
    </button>
  {/snippet}
</Modal>
