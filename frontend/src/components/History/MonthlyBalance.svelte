<script lang="ts">
  import { onMount } from 'svelte';
  import type { MonthlyBalance } from '../../types';
  import { monthlyBalanceApi } from '../../services/api';
  import dayjs from 'dayjs';

  export let year: number;
  export let month: number; // 1-12

  let balances: MonthlyBalance[] = [];
  let loading = false;
  let error: string | null = null;

  async function loadBalances() {
    loading = true;
    error = null;
    try {
      balances = await monthlyBalanceApi.getAllBalances(year, month);
      
      // If no balances exist, calculate them
      if (balances.length === 0) {
        balances = await monthlyBalanceApi.recalculateAllBalances(year, month);
      }
    } catch (err: any) {
      console.error('Failed to load monthly balances:', err);
      error = err.message || 'Failed to load balances';
    } finally {
      loading = false;
    }
  }

  async function recalculate() {
    loading = true;
    error = null;
    try {
      balances = await monthlyBalanceApi.recalculateAllBalances(year, month);
    } catch (err: any) {
      console.error('Failed to recalculate balances:', err);
      error = err.message || 'Failed to recalculate balances';
    } finally {
      loading = false;
    }
  }

  // Load balances when year or month changes
  $: if (year && month) {
    loadBalances();
  }

  function formatMinutes(minutes: number): string {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? '-' : '+';
    return `${sign}${hours}h ${mins}m`;
  }

  function formatHours(minutes: number): string {
    const hours = (minutes / 60).toFixed(1);
    return `${hours}h`;
  }

  function getBalanceColor(balanceMinutes: number): string {
    if (balanceMinutes > 0) return 'text-green-600';
    if (balanceMinutes < 0) return 'text-red-600';
    return 'text-gray-600';
  }
</script>

<div class="bg-white rounded-lg shadow-md p-4 mb-6">
  <div class="flex justify-between items-center mb-3">
    <h3 class="text-sm font-semibold text-gray-700">Monthly Balance</h3>
    <button
      on:click={recalculate}
      disabled={loading}
      class="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
      title="Recalculate balances"
    >
      {loading ? 'Calculating...' : 'Refresh'}
    </button>
  </div>

  {#if error}
    <div class="text-red-600 text-sm mb-2">{error}</div>
  {/if}

  {#if loading && balances.length === 0}
    <div class="text-gray-500 text-sm">Loading balances...</div>
  {:else if balances.length === 0}
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
    </div>
  {/if}
</div>

<style>
  /* Add any custom styles here */
</style>
