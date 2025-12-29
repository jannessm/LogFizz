<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { dailyBalances } from '../stores/balances';
  import { todayTargets } from '../stores/targets';
  import { startBalanceUpdates, stopBalanceUpdates, liveBalanceTick } from '../stores/live-balance';
  import type { Balance, TargetWithSpecs } from '../types';
  import { formatMinutes } from '../../../lib/utils/timeFormat.js';
  import dayjs from '../../../lib/utils/dayjs.js';

  let todayBalances: Balance[] = [];
  const componentId = crypto.randomUUID();
  const today = dayjs().format('YYYY-MM-DD');

  // Filter daily balances for today and combine with target data
  $: {
    // Force recalculation when liveBalanceTick changes
    void $liveBalanceTick;
    
    todayBalances = $dailyBalances
      .filter(b => b.date === today)
      .sort((a, b) => {
        const targetA = $todayTargets.find(t => t.id === a.target_id);
        const targetB = $todayTargets.find(t => t.id === b.target_id);
        return (targetA?.name || '').localeCompare(targetB?.name || '');
      });
  }

  onMount(() => {
    startBalanceUpdates(componentId);
  });

  onDestroy(() => {
    stopBalanceUpdates(componentId);
  });

  function getBalanceColor(balance: number): string {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-800';
  }

  function getTarget(targetId: string): TargetWithSpecs | undefined {
    return $todayTargets.find(t => t.id === targetId);
  }
</script>

{#if todayBalances.length > 0}
  <div class="mb-4">
    <div class="bg-white rounded-lg shadow-md p-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Today's Balance</h3>
      
      <div class="space-y-3">
        {#each todayBalances as balance (balance.id)}
          {@const target = getTarget(balance.target_id)}
          {#if target}
            <div class="border border-gray-200 rounded-lg p-3">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <h4 class="font-medium text-gray-800">{target.name}</h4>
                  {#if target.target_specs.some(spec => spec.exclude_holidays)}
                    <span class="text-xs text-gray-500">
                      (excluding public holidays)
                    </span>
                  {/if}
                </div>
                <div class="text-right">
                  <div class={`text-lg font-bold ${getBalanceColor(balance.cumulative_minutes)}`}>
                    {formatMinutes(balance.cumulative_minutes)}
                  </div>
                </div>
              </div>
              
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span class="text-gray-600">Worked:</span>
                  <span class="font-medium text-gray-800 ml-1">{formatMinutes(balance.worked_minutes)}</span>
                </div>
                <div>
                  <span class="text-gray-600">Due:</span>
                  <span class="font-medium text-gray-800 ml-1">{formatMinutes(balance.due_minutes)}</span>
                </div>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
{/if}
