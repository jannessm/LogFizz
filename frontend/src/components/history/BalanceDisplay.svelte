<script lang="ts">
  import { dayjs, type Balance, type TargetWithSpecs } from '../../types';
  import { formatMinutes, formatMinutesCompact, getBalanceColor } from '../../../../lib/utils/timeFormat.js';
  import type { BalanceGranularity } from '../../services/balanceOverview';
  import { _ } from '../../lib/i18n';

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

<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">
  {granularity === 'year' ? $_('history.yearlyBalance') : granularity === 'month' ? $_('history.monthlyBalance') : $_('history.dailyBalance')}{#if date()}, {date()}{/if}
</h3>
{#if !target}
  <div class="text-gray-500 dark:text-gray-400 text-sm">{$_('history.noTargetSelected')}</div>
{:else if showNoStartingFromWarning && !hasStartingFrom}
  <div class="border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
    <div class="flex justify-between items-start">
      <div>
        <h4 class="font-medium text-gray-800 dark:text-gray-200">{target.name}</h4>
        <span class="text-xs text-amber-700 dark:text-amber-400">
          {$_('history.noStartingDateSet')}
        </span>
      </div>
      <div class="text-right">
        <div class="text-lg font-bold text-gray-400 dark:text-gray-500">--</div>
      </div>
    </div>
  </div>
{:else if canCalculate && !balance}
  <div class="text-gray-500 dark:text-gray-400 text-sm">{$_('history.noBalanceData')}</div>
{:else if balance}
  {#if granularity === 'year'}
    <!-- Year view: includes yearly counters (worked days, sick days, holidays, etc.) -->
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">

      <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <span class="text-gray-600 dark:text-gray-400">{$_('history.workedDays')}</span>
          <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{balance.worked_days}</span>
        </div>
        <div>
          <span class="text-gray-600 dark:text-gray-400">{$_('history.sickDays')}</span>
          <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{balance.sick_days}</span>
        </div>

        <div>
          <span class="text-gray-600 dark:text-gray-400">{$_('history.holidays')}</span>
          <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{balance.holidays}</span>
        </div>
        <div>
          <span class="text-gray-600 dark:text-gray-400">{$_('history.businessTrip')}</span>
          <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{balance.business_trip}</span>
        </div>

        <div>
          <span class="text-gray-600 dark:text-gray-400">{$_('history.childSick')}</span>
          <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{balance.child_sick}</span>
        </div>
        <div>
          <span class="text-gray-600 dark:text-gray-400">{$_('history.homeoffice')}</span>
          <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{balance.homeoffice}</span>
        </div>
      </div>
    </div>
  {:else}
    <!-- Month + Day view -->
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div class="flex justify-between items-start mb-2">
        <div class="text-right">
          <div class={`text-lg font-bold ${getBalanceColor(balance.cumulative_minutes + balance.worked_minutes - balance.due_minutes)}`}>
            {formatMinutes(balance.cumulative_minutes + balance.worked_minutes - balance.due_minutes)}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span class="text-gray-600 dark:text-gray-400">{$_('history.workedLabel')}</span>
          <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{formatMinutesCompact(balance.worked_minutes)}</span>
        </div>
        <div>
          <span class="text-gray-600 dark:text-gray-400">{$_('history.dueLabel')}</span>
          <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{formatMinutesCompact(balance.due_minutes)}</span>
        </div>
      </div>

      {#if granularity === 'month'}
        <!-- Monthly counters (worked days, sick days, holidays, etc.) -->
        <div class="border-t border-gray-200 dark:border-gray-600 mt-3 pt-3">
          <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <span class="text-gray-600 dark:text-gray-400">{$_('history.workedDays')}</span>
              <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{balance.worked_days}</span>
            </div>
            <div>
              <span class="text-gray-600 dark:text-gray-400">{$_('history.sickDays')}</span>
              <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{balance.sick_days}</span>
            </div>

            <div>
              <span class="text-gray-600 dark:text-gray-400">{$_('history.holidays')}</span>
              <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{balance.holidays}</span>
            </div>
            <div>
              <span class="text-gray-600 dark:text-gray-400">{$_('history.businessTrip')}</span>
              <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{balance.business_trip}</span>
            </div>

            <div>
              <span class="text-gray-600 dark:text-gray-400">{$_('history.childSick')}</span>
              <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{balance.child_sick}</span>
            </div>
            <div>
              <span class="text-gray-600 dark:text-gray-400">{$_('history.homeoffice')}</span>
              <span class="font-medium text-gray-800 dark:text-gray-200 ml-1">{balance.homeoffice}</span>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
{/if}
