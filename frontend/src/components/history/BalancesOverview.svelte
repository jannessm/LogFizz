<script lang="ts">
  import { onMount } from 'svelte';
  import type { Balance, TargetWithSpecs } from '../../types';
  import BalanceDisplay from './BalanceDisplay.svelte';
  import {
    loadBalancesByTargetId,
    type BalancePeriod,
  } from '../../services/balanceOverview';
  import { _ } from '../../lib/i18n';
  import { balancesStore } from '../../stores/balances';
  import { dayjs } from '../../types';
  import { liveBalanceTick, liveExtraMinutesByTargetId } from '../../stores/live-balance';

  type BalancesOverviewPeriods = {
    day: BalancePeriod & { date: string };
    month: BalancePeriod & { year: number; month: number };
    year: BalancePeriod & { year: number };
  };

  type BalancesOverviewProps = {
    targets: TargetWithSpecs[];
    periods: BalancesOverviewPeriods;
    title?: string;
  };

  let { targets, periods, title = $_('balanceOverview.title') }: BalancesOverviewProps = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);

  let balancesDayByTargetId = $state<Map<string, Balance>>(new Map());
  let balancesMonthByTargetId = $state<Map<string, Balance>>(new Map());
  let balancesYearByTargetId = $state<Map<string, Balance>>(new Map());
  // Today's daily balances, always loaded independently of the calendar selection
  let balancesTodayByTargetId = $state<Map<string, Balance>>(new Map());

  let selectedTargetId = $state<string | null>(null);
  
  // Subscribe to balance store changes to trigger reload
  let balanceStoreState = $derived($balancesStore);

  const activeTargets = $derived((targets || []).filter(t => !t.deleted_at));

  const selectedTarget = $derived(
    selectedTargetId
      ? activeTargets.find(t => t.id === selectedTargetId) || null
      : null
  );

  const formattedDate = $derived(() => {
    if (!periods?.day) return '';
    return dayjs(periods.day.date).format('dddd, DD MMMM YYYY');
  });

  function getTargetButtonClass(targetId: string): string {
    const isSelected = targetId === selectedTargetId;
    return [
      'px-3 py-1.5 rounded-full text-sm border transition-colors whitespace-nowrap',
      isSelected
        ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600',
    ].join(' ');
  }

  function selectTarget(targetId: string) {
    selectedTargetId = targetId;
  }

  function preselectTargetWithMostDueMinutes(map: Map<string, Balance>) {
    if (selectedTargetId) return;
    if (activeTargets.length === 0) {
      selectedTargetId = null;
      return;
    }

    let bestTargetId: string | null = null;
    let bestDue = -Infinity;

    for (const t of activeTargets) {
      const b = map.get(t.id);
      const due = b?.due_minutes ?? -Infinity;
      if (due > bestDue) {
        bestDue = due;
        bestTargetId = t.id;
      }
    }

    selectedTargetId = bestTargetId ?? activeTargets[0]?.id ?? null;
  }

  const selectedDayBalance = $derived(
    selectedTargetId ? balancesDayByTargetId.get(selectedTargetId) || null : null
  );

  // Whether the day period shown is today — only then do we apply live adjustment
  const isDayToday = $derived(
    periods?.day?.date === dayjs().format('YYYY-MM-DD')
  );

  /**
   * Live-adjusted day balance: adds elapsed minutes from currently running
   * timelogs on top of the stored worked_minutes, exactly like TargetProgressBar.
   * liveBalanceTick is consumed so this recomputes every minute.
   */
  const liveDayBalance = $derived((() => {
    // reference tick so Svelte tracks it
    const _tick = $liveBalanceTick;
    const base = selectedDayBalance;
    if (!base || !isDayToday || !selectedTargetId) return base;
    const extra = $liveExtraMinutesByTargetId.get(selectedTargetId) ?? 0;
    if (extra <= 0) return base;
    return { ...base, worked_minutes: base.worked_minutes + extra };
  })());

  const selectedMonthBalance = $derived(
    selectedTargetId ? balancesMonthByTargetId.get(selectedTargetId) || null : null
  );

  // Whether the month period shown is the current month
  const isMonthCurrent = $derived(
    periods?.month?.year === dayjs().year() &&
    periods?.month?.month === dayjs().month() + 1
  );

  /**
   * Monthly balance without today's contribution.
   * When viewing the current month, subtract today's stored daily balance so
   * the aggregate only reflects completed days (up to and including yesterday).
   */
  const monthBalanceUntilYesterday = $derived((() => {
    const base = selectedMonthBalance;
    if (!base || !isMonthCurrent || !selectedTargetId) return base;
    const today = balancesTodayByTargetId.get(selectedTargetId) ?? null;
    if (!today) return base;
    return {
      ...base,
      worked_minutes: base.worked_minutes - today.worked_minutes,
      due_minutes: base.due_minutes - today.due_minutes,
      sick_days: base.sick_days - today.sick_days,
      holidays: base.holidays - today.holidays,
      business_trip: base.business_trip - today.business_trip,
      child_sick: base.child_sick - today.child_sick,
      homeoffice: base.homeoffice - today.homeoffice,
      normal_days: base.normal_days - today.normal_days,
      worked_days: base.worked_days - today.worked_days,
    };
  })());

  const selectedYearBalance = $derived(
    selectedTargetId ? balancesYearByTargetId.get(selectedTargetId) || null : null
  );

  // Whether the year period shown is the current year
  const isYearCurrent = $derived(periods?.year?.year === dayjs().year());

  /**
   * Yearly balance without today's contribution.
   * When viewing the current year, subtract today's stored daily balance so
   * the aggregate only reflects completed days (up to and including yesterday).
   */
  const yearBalanceUntilYesterday = $derived((() => {
    const base = selectedYearBalance;
    if (!base || !isYearCurrent || !selectedTargetId) return base;
    const today = balancesTodayByTargetId.get(selectedTargetId) ?? null;
    if (!today) return base;
    return {
      ...base,
      worked_minutes: base.worked_minutes - today.worked_minutes,
      due_minutes: base.due_minutes - today.due_minutes,
      sick_days: base.sick_days - today.sick_days,
      holidays: base.holidays - today.holidays,
      business_trip: base.business_trip - today.business_trip,
      child_sick: base.child_sick - today.child_sick,
      homeoffice: base.homeoffice - today.homeoffice,
      normal_days: base.normal_days - today.normal_days,
      worked_days: base.worked_days - today.worked_days,
    };
  })());

  async function load() {
    loading = true;
    error = null;

    try {
      const todayDate = dayjs().format('YYYY-MM-DD');
      const [dayRes, monthRes, yearRes, todayRes] = await Promise.all([
        loadBalancesByTargetId({ granularity: 'day', period: periods.day }),
        loadBalancesByTargetId({ granularity: 'month', period: periods.month }),
        loadBalancesByTargetId({ granularity: 'year', period: periods.year }),
        loadBalancesByTargetId({ granularity: 'day', period: { date: todayDate } }),
      ]);

      balancesDayByTargetId = dayRes.balancesByTargetId;
      balancesMonthByTargetId = monthRes.balancesByTargetId;
      balancesYearByTargetId = yearRes.balancesByTargetId;
      balancesTodayByTargetId = todayRes.balancesByTargetId;

      // Prefer selecting based on the year view (most representative for a default)
      preselectTargetWithMostDueMinutes(yearRes.balancesByTargetId);
    } catch (err: any) {
      console.error('Failed to load balances overview:', err);
      error = err?.message || $_('balanceOverview.loadFailed');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // Reload when periods change OR when balance store changes
    if (balanceStoreState && periods?.day && periods?.month && periods?.year) {
      load();
    }
  });

  // Keep selection valid when targets change.
  $effect(() => {
    if (activeTargets.length === 0) {
      selectedTargetId = null;
      return;
    }
    if (selectedTargetId && !activeTargets.some(t => t.id === selectedTargetId)) {
      selectedTargetId = null;
    }
    if (!selectedTargetId) {
      selectedTargetId = activeTargets[0]?.id ?? null;
    }
  });

  onMount(() => {
    if (!selectedTargetId && activeTargets.length > 0) {
      selectedTargetId = activeTargets[0].id;
    }
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
  <div class="flex justify-between items-center mb-3">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
  </div>

  {#if error}
    <div class="text-red-600 dark:text-red-400 text-sm mb-2">{error}</div>
  {/if}

  {#if activeTargets.length > 0}
    <div class="flex gap-2 overflow-x-auto pb-2 mb-4">
      {#each activeTargets.sort((a, b) => a.name.localeCompare(b.name)) as target (target.id)}
        <button
          type="button"
          class={getTargetButtonClass(target.id)}
          onclick={() => selectTarget(target.id)}
          aria-pressed={target.id === selectedTargetId}
        >
          {target.name}
        </button>
      {/each}
    </div>
  {/if}

  {#if loading && balancesYearByTargetId.size === 0 && balancesMonthByTargetId.size === 0 && balancesDayByTargetId.size === 0}
    <div class="text-gray-500 dark:text-gray-400 text-sm">{$_('history.loadingBalances')}</div>
  {:else if activeTargets.length === 0}
    <div class="text-gray-500 dark:text-gray-400 text-sm">{$_('history.noTargetsConfigured')}</div>
  {:else}
    <div class="flex flex-col gap-3">
      <BalanceDisplay granularity="day" target={selectedTarget} balance={liveDayBalance} />
      <BalanceDisplay granularity="month" target={selectedTarget} balance={monthBalanceUntilYesterday} showUntilYesterdayHint={isMonthCurrent} />
      <BalanceDisplay granularity="year" target={selectedTarget} balance={yearBalanceUntilYesterday} showUntilYesterdayHint={isYearCurrent} />
    </div>
  {/if}
</div>
