<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Balance } from '../../types';
  import type { TargetWithSpecs } from '../../types';
  import { balanceApi, isOnline } from '../../services/api';
  import { 
    saveBalance,
    getSyncCursor,
    saveSyncCursor,
  } from '../../lib/db';
  import { balancesStore } from '../../stores/balances';
  import { targetsStore } from '../../stores/targets';
  import { formatMinutes, formatHours, getBalanceColor } from '../../../../lib/utils/timeFormat.js';
  import { _ } from '../../lib/i18n';

  let { year, month }: { year: number; month: number; } = $props();

  let balances: Balance[] = [];
  let targetsWithoutStartingFrom: TargetWithSpecs[] = [];
  let loading = false;
  let error: string | null = null;
  let refreshTick = 0; // Used to trigger reactivity for running sessions
  let intervalId: number | undefined;

  async function loadBalances() {
    loading = true;
    error = null;
    try {
      // Load targets to find those without starting_from in any target_spec
      const allTargets = targetsStore.getAll();
      targetsWithoutStartingFrom = allTargets.filter(t => {
        // Check if any target_spec has a starting_from date
        const hasStartingFrom = t.target_specs?.some(spec => spec.starting_from);
        return !hasStartingFrom;
      });

      // Load monthly balances from local DB (date format: YYYY-MM)
      const dateKey = `${year}-${month.toString().padStart(2, '0')}`;
      const localBalances = await balancesStore.getBalancesByDate(dateKey);
      balances = localBalances;

      // Sync from server in background
      if (isOnline()) {
        await syncFromServer();
      }
    } catch (err: any) {
      console.error('Failed to load monthly balances:', err);
      error = err.message || 'Failed to load balances';
    } finally {
      loading = false;
    }
  }

  async function syncFromServer() {
    try {
      // Get last sync cursor
      let cursor = await getSyncCursor('balances');
      if (!cursor) {
        // First sync - use epoch time to get all data
        cursor = new Date(0).toISOString();
      }

      const result = await balanceApi.getSyncChanges(cursor);

      // Apply changes to local DB
      for (const balance of result.balances) {
        await saveBalance(balance);
      }

      // Save new cursor
      await saveSyncCursor('balances', result.cursor);

      // Reload from DB to reflect changes for current month
      const dateKey = `${year}-${month.toString().padStart(2, '0')}`;
      const updatedBalances = await balancesStore.getBalancesByDate(dateKey);
      balances = updatedBalances;
    } catch (err) {
      console.error('Failed to sync balances from server:', err);
    }
  }

  // Load balances when year or month changes
  $effect(() => {
    if (year && month || refreshTick) {
      loadBalances();
    }
  });

  // Check if there are any running sessions in current workspace
  async function hasRunningSessions(): Promise<boolean> {
    const { getTimeLogsByYearMonth } = await import('../../lib/db');
    const timeLogs = await getTimeLogsByYearMonth(year, month);
    return timeLogs.some(tl => tl.start_timestamp && !tl.end_timestamp);
  }

  // Set up interval to refresh running sessions every 30 seconds
  onMount(async () => {
    if (await hasRunningSessions()) {
      intervalId = window.setInterval(async () => {
        if (await hasRunningSessions()) {
          refreshTick++;
        } else if (intervalId) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      }, 30000); // Update every 30 seconds
    }
  });

  onDestroy(() => {
    if (intervalId) {
      window.clearInterval(intervalId);
    }
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
  <div class="flex justify-between items-center mb-3">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">{$_('history.monthlyBalance')}</h3>
  </div>

  {#if error}
    <div class="text-red-600 dark:text-red-400 text-sm mb-2">{error}</div>
  {/if}

  {#if loading && balances.length === 0 && targetsWithoutStartingFrom.length === 0}
    <div class="text-gray-500 dark:text-gray-400 text-sm">{$_('history.loadingBalances')}</div>
  {:else if balances.length === 0 && targetsWithoutStartingFrom.length === 0}
    <div class="text-gray-500 dark:text-gray-400 text-sm">{$_('history.noTargetsConfiguredThisMonth')}</div>
  {:else}
    <div class="space-y-3">
      {#each balances as balance (balance.id)}
        <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h4 class="font-medium text-gray-800 dark:text-gray-100">{$_('target.title')}</h4>
            </div>
            <div class="text-right">
              <div class={`text-lg font-bold ${getBalanceColor(balance.cumulative_minutes)}`}>
                {formatMinutes(balance.cumulative_minutes)}
              </div>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span class="text-gray-600 dark:text-gray-400">{$_('history.workedLabel')}</span>
              <span class="font-medium text-gray-800 dark:text-gray-100 ml-1">{formatHours(balance.worked_minutes)}</span>
            </div>
            <div>
              <span class="text-gray-600 dark:text-gray-400">{$_('history.dueLabel')}</span>
              <span class="font-medium text-gray-800 dark:text-gray-100 ml-1">{formatHours(balance.due_minutes)}</span>
            </div>
          </div>
        </div>
      {/each}
      
      {#each targetsWithoutStartingFrom.sort((a, b) => a.name.localeCompare(b.name)) as target (target.id)}
        <div class="border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-medium text-gray-800 dark:text-gray-100">{target.name}</h4>
              <span class="text-xs text-amber-700 dark:text-amber-400">
                ⚠️ {$_('history.noStartingDateSet')}
              </span>
            </div>
            <div class="text-right">
              <div class="text-lg font-bold text-gray-400 dark:text-gray-500">
                --
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Add any custom styles here */
</style>
