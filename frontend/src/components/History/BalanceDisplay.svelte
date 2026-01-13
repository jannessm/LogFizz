<script lang="ts">
  import { dayjs, type Balance, type TargetWithSpecs } from '../../types';
  import { formatMinutes, formatHours, getBalanceColor } from '../../../../lib/utils/timeFormat.js';
  import type { BalanceGranularity } from '../../services/balanceOverview';

  let {
    granularity,
    target,
    balance,
    showNoStartingFromWarning = true,
  }: {
    granularity: BalanceGranularity;
    target: TargetWithSpecs | null;
    balance: Balance | null;
    showNoStartingFromWarning?: boolean;
  } = $props();

  const hasStartingFrom = $derived(
    !target
      ? false
      : !!target.target_specs?.some(spec => !!spec.starting_from)
  );

  const canCalculate = $derived(!!target && (hasStartingFrom || !showNoStartingFromWarning));

  const date = $derived(() => {
    if (!balance) return null;
    if (granularity === 'day') {
      return dayjs(balance.date).format('LL');
    } else if (granularity === 'month') {
      return dayjs(balance.date).format('MMMM YYYY');
    } else if (granularity === 'year') {
      return dayjs(balance.date).format('YYYY');
    }
    return null;
  });
</script>

<h3 class="text-sm font-semibold text-gray-800">
  {granularity === 'year' ? 'Yearly Balance' : granularity === 'month' ? 'Monthly Balance' : 'Daily Balance'}{#if date()}, {date()}{/if}
</h3>
{#if !target}
  <div class="text-gray-500 text-sm">No target selected.</div>
{:else if showNoStartingFromWarning && !hasStartingFrom}
  <div class="border border-amber-200 bg-amber-50 rounded-lg p-3">
    <div class="flex justify-between items-start">
      <div>
        <h4 class="font-medium text-gray-800">{target.name}</h4>
        <span class="text-xs text-amber-700">
          No starting date set - balance cannot be calculated
        </span>
      </div>
      <div class="text-right">
        <div class="text-lg font-bold text-gray-400">--</div>
      </div>
    </div>
  </div>
{:else if canCalculate && !balance}
  <div class="text-gray-500 text-sm">No balance data for this period.</div>
{:else if balance}
  {#if granularity === 'year'}
    <!-- Year view: includes yearly counters (worked days, sick days, holidays, etc.) -->
    <div class="border border-gray-200 rounded-lg p-3">

      <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <span class="text-gray-600">Worked days:</span>
          <span class="font-medium text-gray-800 ml-1">{balance.worked_days}</span>
        </div>
        <div>
          <span class="text-gray-600">Sick days:</span>
          <span class="font-medium text-gray-800 ml-1">{balance.sick_days}</span>
        </div>

        <div>
          <span class="text-gray-600">Holidays:</span>
          <span class="font-medium text-gray-800 ml-1">{balance.holidays}</span>
        </div>
        <div>
          <span class="text-gray-600">Business trip:</span>
          <span class="font-medium text-gray-800 ml-1">{balance.business_trip}</span>
        </div>

        <div class="col-span-2">
          <span class="text-gray-600">Child sick:</span>
          <span class="font-medium text-gray-800 ml-1">{balance.child_sick}</span>
        </div>
      </div>
    </div>
  {:else}
    <!-- Month + Day view -->
    <div class="border border-gray-200 rounded-lg p-3">
      <div class="flex justify-between items-start mb-2">
        <div class="text-right">
          <div class={`text-lg font-bold ${getBalanceColor(balance.cumulative_minutes + balance.worked_minutes - balance.due_minutes)}`}>
            {formatMinutes(balance.cumulative_minutes + balance.worked_minutes - balance.due_minutes)}
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
  {/if}
{/if}
