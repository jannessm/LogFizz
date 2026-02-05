<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from '../components/BottomNav.svelte';
  import ProfileSection from '../components/settings/ProfileSection.svelte';
  import PasswordSection from '../components/settings/PasswordSection.svelte';
  import SyncStatusSection from '../components/settings/SyncStatusSection.svelte';
  import { authStore } from '../stores/auth';
  import { themeStore, type ThemeMode } from '../stores/theme';
  import { userSettingsStore } from '../stores/userSettings';
  import { syncService } from '../services/sync';
  import { navigate } from '../lib/navigation';
  import { getSetting, saveSetting } from '../lib/db';
  import { snackbar } from '../stores/snackbar';
  import { balancesStore } from '../stores/balances';
  import { setLocale, _ } from '../lib/i18n';
  import { setDayjsLocale } from '../lib/dateFormatting';
  import { get } from 'svelte/store';
  // Import version from frontend package.json
  // Vite allows importing JSON files directly
  import pkg from '../../package.json';

  let name = $state('');
  let originalName = $state('');
  let hasPendingSync = $state(false);
  let editOnStopEnabled = $state(true);
  let autoToggle = $state(true);
  let isRecalculating = $state(false);
  let themeMode: ThemeMode = $state('auto');
  let firstDayOfWeek: 'sunday' | 'monday' = $state('sunday');
  let language: 'en' | 'de' = $state('en');
  let locale: string = $state('en-US');

  let user = $derived($authStore.user);
  let isOnline = $derived(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Available locales with examples
  const localeOptions = [
    { value: 'en-US', label: $_('settings.dateEnglishUS'), example: '01/05/2026, 3:30 PM', dateExample: 'January 5, 2026' },
    { value: 'en-GB', label: $_('settings.dateEnglishUK'), example: '05/01/2026, 15:30', dateExample: '5 January 2026' },
    { value: 'de-DE', label: $_('settings.dateGerman'), example: '05.01.2026, 15:30', dateExample: '5. Januar 2026' },
  ];

  onMount(async () => {
    if (user) {
      name = user.name;
      originalName = user.name;
    }
    hasPendingSync = await syncService.hasPendingSync();
    const setting = await getSetting('editOnStop');
    editOnStopEnabled = setting !== false; // default true
    const autoToggleSetting = await getSetting('autoToggle');
    autoToggle = autoToggleSetting !== false; // default true

    // Load theme setting
    themeMode = $themeStore.mode;
    
    // Load first day of week setting
    const firstDaySetting = await getSetting('firstDayOfWeek');
    firstDayOfWeek = firstDaySetting || 'sunday'; // default sunday

    // Read user settings from store (already initialized in App.svelte)
    const userSettings = $userSettingsStore.settings;
    if (userSettings) {
      language = (userSettings.language as 'en' | 'de') || 'en';
      locale = userSettings.locale || 'en-US';
    }
  });

  async function handleProfileUpdate(event: { name: string }) {
    const { name: updatedName } = event;
    
    try {
      const updatedUser = await authStore.updateProfile({ 
        name: updatedName
      });
      snackbar.success($_('settings.profileUpdated'));
      // Update local state with the server response
      name = updatedUser.name;
      originalName = updatedUser.name;
    } catch (error: any) {
      snackbar.error(error.message);
    }
  }

  async function handlePasswordChange(currentPassword: string, newPassword: string) {
    try {
      await authStore.changePassword(currentPassword, newPassword);
      snackbar.success($_('settings.passwordChanged'));
    } catch (error: any) {
      snackbar.error(error.message);
    }
  }

  async function handleSync() {
    try {
      let syncingSnackbarId: string | null = null;
      const showSyncingTimeout = setTimeout(() => {
        syncingSnackbarId = snackbar.info($_('settings.syncing'), 2000);
      }, 1000);

      await syncService.sync('all');
      hasPendingSync = await syncService.hasPendingSync();
      
      clearTimeout(showSyncingTimeout);
      if (syncingSnackbarId) {
        snackbar.dismiss(syncingSnackbarId);
      }
      
      snackbar.success($_('settings.syncCompleted'));
    } catch (error: any) {
      snackbar.error(error.message || $_('settings.syncFailed'));
    }
  }

  async function handleRecalculateBalances() {
    if (isRecalculating) return;
    
    try {
      isRecalculating = true;
      snackbar.info($_('settings.recalculating'), 3000);
      
      await balancesStore.recalculateBalances();
      
      snackbar.success($_('settings.recalculateSuccess'));
    } catch (error: any) {
      snackbar.error(error.message || $_('settings.recalculateFailed'));
    } finally {
      isRecalculating = false;
    }
  }

  async function handleLogout() {
    await authStore.logout();
    navigate('/login');
  }

  function handleError(message: string) {
    snackbar.error(message);
  }

  async function handleToggleEditOnStop() {
    await saveSetting('editOnStop', editOnStopEnabled);
  }

  async function handleToggleAutoToggle() {
    await saveSetting('autoToggle', autoToggle);
  }

  async function handleThemeChange() {
    await themeStore.setMode(themeMode);
  }

  async function handleFirstDayChange() {
    await saveSetting('firstDayOfWeek', firstDayOfWeek);
  }

  async function handleLanguageChange() {
    try {
      await userSettingsStore.updateSettings({ language });
      // Update i18n locale
      setLocale(language);
      snackbar.success($_('settings.languageUpdated'));
    } catch (error: any) {
      snackbar.error(error.message || $_('common.error'));
    }
  }

  async function handleLocaleChange() {
    try {
      await userSettingsStore.updateSettings({ locale });
      // Update dayjs locale for date formatting
      setDayjsLocale(locale);
      snackbar.success($_('settings.dateFormatUpdated'));
    } catch (error: any) {
      snackbar.error(error.message || $_('common.error'));
    }
  }
</script>

<div class="h-screen flex flex-col">
  <!-- Full-width scrollable settings container -->
  <div class="w-full px-4 py-6 flex-1 overflow-auto">
    <!-- Inner centered container to preserve original max-width layout -->
    <div class="w-full max-w-lg mx-auto">
      <!-- Header -->
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">{$_('settings.title')}</h1>

      <ProfileSection
        email={user?.email || ''}
        bind:name
        {originalName}
        onsubmit={handleProfileUpdate}
        onerror={handleError}
      />

      <PasswordSection
        onsubmit={handlePasswordChange}
        onerror={handleError}
      />

      <SyncStatusSection
        {hasPendingSync}
        {isOnline}
        onsync={handleSync}
      />

      <!-- Appearance -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">{$_('settings.appearance')}</h3>
        
        <!-- Theme Setting -->
        <div class="mb-4">
          <label for="theme-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {$_('settings.theme')}
          </label>
          <select
            id="theme-select"
            bind:value={themeMode}
            onchange={handleThemeChange}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="light">{$_('settings.themeLight')}</option>
            <option value="dark">{$_('settings.themeDark')}</option>
            <option value="auto">{$_('settings.themeAuto')}</option>
          </select>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {$_('settings.themeDescription')}
          </p>
        </div>

        <!-- First Day of Week Setting -->
        <div>
          <label for="first-day-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {$_('settings.firstDayOfWeek')}
          </label>
          <select
            id="first-day-select"
            bind:value={firstDayOfWeek}
            onchange={handleFirstDayChange}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="sunday">{$_('settings.sunday')}</option>
            <option value="monday">{$_('settings.monday')}</option>
          </select>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {$_('settings.firstDayDescription')}
          </p>
        </div>
      </div>

      <!-- Language & Region -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">{$_('settings.languageRegion')}</h3>
        
        <!-- Language Setting -->
        <div class="mb-4">
          <label for="language-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {$_('settings.language')}
          </label>
          <select
            id="language-select"
            bind:value={language}
            onchange={handleLanguageChange}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="en">{$_('settings.languageEnglish')}</option>
            <option value="de">{$_('settings.languageGerman')}</option>
          </select>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {$_('settings.languageDescription')}
          </p>
        </div>

        <!-- Locale/Date Format Setting -->
        <div>
          <label for="locale-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {$_('settings.dateTimeFormat')}
          </label>
          <select
            id="locale-select"
            bind:value={locale}
            onchange={handleLocaleChange}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {#each localeOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          {#each localeOptions as option (option.value)}
            {#if locale === option.value}
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {option.dateExample} / {option.example}
              </p>
            {/if}
          {/each}
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {$_('settings.dateTimeDescription')}
          </p>
        </div>
      </div>
  
      <!-- Subscription -->
      <!-- <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">{$_('subscription.subscription')}</h3>
        <button
          onclick={() => navigate('/payment')}
          class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <span>{$_('subscription.manageSubscription')}</span>
        </button>
        <p class="text-sm text-gray-500 mt-2">
          {$_('subscription.viewSubscriptionStatus')}
        </p>
      </div> -->

      <!-- Timer Behavior -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">{$_('settings.timerBehavior')}</h3>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={editOnStopEnabled}
            onchange={handleToggleEditOnStop}
            class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span class="text-gray-700 dark:text-gray-300">{$_('settings.editOnStop')}</span>
        </label>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 ml-6">
          {$_('settings.editOnStopDescription')}
        </p>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={autoToggle}
            onchange={handleToggleAutoToggle}
            class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span class="text-gray-700 dark:text-gray-300">{$_('settings.autoToggle')}</span>
        </label>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 ml-6">
          {$_('settings.autoToggleDescription')}
        </p>
      </div>

      <!-- Maintenance -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">{$_('settings.maintenance')}</h3>
        <button
          onclick={handleRecalculateBalances}
          disabled={isRecalculating}
          class="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-hover transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {#if isRecalculating}
            <span class="w-5 h-5 icon-[svg-spinners--3-dots-fade]"></span>
            {$_('settings.recalculating')}
          {:else}
            {$_('settings.recalculateBalances')}
          {/if}
        </button>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {$_('settings.recalculateDescription')}
        </p>
      </div>

      <!-- Logout -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <button
          onclick={handleLogout}
          class="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
        >
          <span class="w-5 h-5 icon-[si--sign-out-line]"></span>
          {$_('auth.logout')}
        </button>
      </div>

      <!-- Footer with version and legal links -->
      <div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <div class="mb-2">{$_('common.version')} {pkg.version}</div>
        <div class="flex justify-center gap-4">
          <!-- <a href="/impressum" class="hover:underline text-gray-600" target="_blank" rel="noopener noreferrer">{$_('legal.impressum')}</a>
          <a href="/datenschutz" class="hover:underline text-gray-600" target="_blank" rel="noopener noreferrer">{$_('legal.privacyPolicy')}</a> -->
        </div>
      </div>
    </div>
  </div>

  <BottomNav currentTab="settings" />
</div>
