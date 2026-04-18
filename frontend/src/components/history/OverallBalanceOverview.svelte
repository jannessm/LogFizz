<script lang="ts">
  import { onMount } from 'svelte';
  import type { TargetWithSpecs } from '../../types';
  import {
    loadBalancesByTargetId,
    type BalancePeriod,
  } from '../../services/balanceOverview';
  import { _ } from '../../lib/i18n';
  import { balancesStore } from '../../stores/balances';
  import { formatMinutes, getBalanceColor } from '../../../../lib/utils/timeFormat.js';
  import { liveExtraMinutesByTargetId } from '../../stores/live-balance';

  type OverallBalancePeriods = {
    year: BalancePeriod & { year: number };
  };

  type OverallBalanceOverviewProps = {
    targets: TargetWithSpecs[];
    periods: OverallBalancePeriods;
    title?: string;
  };

  let { targets, periods, title = $_('balanceOverview.overallBalance') }: OverallBalanceOverviewProps = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);

  let balancesYearByTargetId = $state<Map<string, any>>(new Map());

  // Subscribe to balance store changes to trigger reload
  let balanceStoreState = $derived($balancesStore);

  const activeTargets = $derived((targets || []).filter(t => !t.deleted_at));

  const hasStartingFrom = (target: TargetWithSpecs): boolean => {
    return !!target.target_specs?.some(spec => !!spec.starting_from);
  };

  /**
   * Calculate overall balance from yearly balance, with live adjustment for
   * any currently active timelogs (extra minutes not yet baked into the store).
   * Overall balance = cumulative_minutes + (worked_minutes - due_minutes) + liveExtra
   */
  const overallBalances = $derived.by(() => {
    const balances: Array<{ targetId: string; targetName: string; overallBalance: number; color: string }> = [];
    
    for (const target of activeTargets) {
      if (!hasStartingFrom(target)) continue;
      
      const yearlyBalance = balancesYearByTargetId.get(target.id);
      if (!yearlyBalance) continue;
      
      const liveExtra = $liveExtraMinutesByTargetId.get(target.id) ?? 0;
      const overallBalance = yearlyBalance.cumulative_minutes + 
                           (yearlyBalance.worked_minutes - yearlyBalance.due_minutes) +
                           liveExtra;
      
      balances.push({
        targetId: target.id,
        targetName: target.name,
        overallBalance,
        color: getBalanceColor(overallBalance),
      });
    }
    
    return balances;
  });

  async function load() {
    loading = true;
    error = null;

    try {
      const yearRes = await loadBalancesByTargetId({ 
        granularity: 'year', 
        period: periods.year 
      });
      balancesYearByTargetId = yearRes.balancesByTargetId;
    } catch (err: any) {
      console.error('Failed to load overall balance:', err);
      error = err?.message || $_('balanceOverview.loadFailed');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // Reload when balance store changes OR when periods change
    if (balanceStoreState && periods?.year) {
      load();
    }
  });

  onMount(() => {
    load();
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
  <div class="flex justify-between items-center mb-3">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
  </div>

  {#if error}
    <div class="text-red-600 dark:text-red-400 text-sm mb-2">{error}</div>
  {/if}

  {#if loading && balancesYearByTargetId.size === 0}
    <div class="text-gray-500 dark:text-gray-400 text-sm">{$_('history.loadingBalances')}</div>
  {:else if activeTargets.length === 0}
    <div class="text-gray-500 dark:text-gray-400 text-sm">{$_('history.noTargetsConfigured')}</div>
  {:else if overallBalances.length === 0}
    <div class="text-gray-500 dark:text-gray-400 text-sm">{$_('history.noTargetsConfigured')}</div>
  {:else}
    <div class="space-y-2">
      {#each overallBalances as balance (balance.targetId)}
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {balance.targetName}
            </span>
            <div class={`text-lg font-bold ${balance.color}`}>
              {formatMinutes(balance.overallBalance)}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
