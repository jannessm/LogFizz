<script lang="ts">
  import { onMount } from 'svelte';
  import type { MonthlyBalance, DailyTarget } from '../../types';
  import { monthlyBalanceApi, isOnline } from '../../services/api';
  import { 
    getMonthlyBalancesByYearMonth, 
    saveMonthlyBalance,
    getSyncCursor,
    saveSyncCursor,
    getAllTargets
  } from '../../lib/db';
  import dayjs from 'dayjs';
  import { formatMinutes, formatHours, getBalanceColor } from '../../../../lib/utils/timeFormat.js';

  export let year: number;
  export let month: number; // 1-12

  let balances: MonthlyBalance[] = [];
  let targetsWithoutStartingFrom: DailyTarget[] = [];
  let loading = false;
  let error: string | null = null;

  async function loadBalances() {
    loading = true;
    error = null;
    try {
      // Load from local DB first (fast - show data immediately)
      const localBalances = await getMonthlyBalancesByYearMonth(year, month);
      balances = localBalances;

      // Load targets to find those without starting_from
      const allTargets = await getAllTargets();
      targetsWithoutStartingFrom = allTargets.filter(t => !t.starting_from && !t.deleted_at);

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
      let cursor = await getSyncCursor('monthlyBalances');
      if (!cursor) {
        // First sync - use epoch time to get all data
        cursor = new Date(0).toISOString();
      }

      const result = await monthlyBalanceApi.getSyncChanges(cursor);

      // Apply changes to local DB
      for (const balance of result.monthlyBalances) {
        await saveMonthlyBalance(balance);
      }

      // Save new cursor
      await saveSyncCursor('monthlyBalances', result.cursor);

      // Reload from DB to reflect changes for current month
      const updatedBalances = await getMonthlyBalancesByYearMonth(year, month);
      balances = updatedBalances;
    } catch (err) {
      console.error('Failed to sync monthly balances from server:', err);
    }
  }

  // Load balances when year or month changes
  $: if (year && month) {
    loadBalances();
  }
</script>

<div class="bg-white rounded-lg shadow-md p-4 mb-6">
  <div class="flex justify-between items-center mb-3">
    <h3 class="text-sm font-semibold text-gray-700">Monthly Balance</h3>
  </div>

  {#if error}
    <div class="text-red-600 text-sm mb-2">{error}</div>
  {/if}

  {#if loading && balances.length === 0 && targetsWithoutStartingFrom.length === 0}
    <div class="text-gray-500 text-sm">Loading balances...</div>
  {:else if balances.length === 0 && targetsWithoutStartingFrom.length === 0}
    <div class="text-gray-500 text-sm">No targets configured for this month.</div>
  {:else}
    <div class="space-y-3">
      {#each balances.slice().sort((a, b) => (a.target?.name || '').localeCompare(b.target?.name || '')) as balance (balance.id)}
        <div class="border border-gray-200 rounded-lg p-3">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h4 class="font-medium text-gray-800">{balance.target?.name || 'Target'}</h4>
              {#if balance.exclude_holidays}
                <span class="text-xs text-gray-500">
                  (excluding public holidays)
                </span>
              {/if}
            </div>
            <div class="text-right">
              <div class={`text-lg font-bold ${getBalanceColor(balance.balance_minutes)}`}>
                {formatMinutes(balance.balance_minutes)}
              </div>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span class="text-gray-600">Worked:</span>
              <span class="font-medium text-gray-800 ml-1">{formatHours(balance.worked_minutes)}</span>
            </div>
            <div>
              <span class="text-gray-600">Due:</span>
              <span class="font-medium text-gray-800 ml-1">{formatHours(balance.due_minutes)}</span>
            </div>
          </div>
        </div>
      {/each}
      
      {#each targetsWithoutStartingFrom.sort((a, b) => a.name.localeCompare(b.name)) as target (target.id)}
        <div class="border border-amber-200 bg-amber-50 rounded-lg p-3">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-medium text-gray-800">{target.name}</h4>
              <span class="text-xs text-amber-700">
                ⚠️ No starting date set - balance cannot be calculated
              </span>
            </div>
            <div class="text-right">
              <div class="text-lg font-bold text-gray-400">
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
