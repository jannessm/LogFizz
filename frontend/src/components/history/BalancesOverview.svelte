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
  import { timers } from '../../stores/timers';
  import { activeTimeLogs } from '../../stores/timelogs';
  import { liveBalanceTick } from '../../stores/live-balance';

  /**
   * Estimate break deduction for an active timelog based on German rules.
   * Mirrors the logic in TargetProgressBar.
   */
  function getBreakDeduction(elapsedMinutes: number): number {
    if (elapsedMinutes >= 9 * 60) return 45;
    if (elapsedMinutes >= 6 * 60) return 30;
    return 0;
  }

  /**
   * Compute extra worked minutes from currently active timelogs for a target,
   * excluding minutes already baked into the stored balance (i.e., minutes that
   * were active at the time the last recalculation ran).
   * We add the full current elapsed minutes because recalculateTodayBalances()
   * re-runs the full day calculation each tick, so worked_minutes in the store
   * already reflects the state at the last tick. We only need to add the delta
   * since the last tick (up to ~1 minute), but since tick resolution is 1 min
   * and we re-derive every second visually we just compute the running total
   * from scratch and subtract what's stored — same approach as TargetProgressBar.
   */
  function computeActiveExtraMinutes(
    targetId: string,
    storedWorkedMinutes: number,
    allTimers: typeof $timers,
    activeLogs: typeof $activeTimeLogs
  ): number {
    const linkedTimerIds = new Set(
      allTimers.filter(t => t.target_id === targetId).map(t => t.id)
    );
    const todayStr = dayjs().format('YYYY-MM-DD');
    const todayStart = dayjs().startOf('day').utc();
    const now = dayjs.utc();

    let activeMinutes = 0;
    for (const tl of activeLogs) {
      if (!linkedTimerIds.has(tl.timer_id)) continue;

      const startMoment = dayjs.utc(tl.start_timestamp);
      // only count if the timelog touches today
      const logDate = startMoment.local().format('YYYY-MM-DD');
      if (logDate !== todayStr && startMoment.isAfter(now)) continue;

      let elapsed = now.diff(startMoment, 'minute');
      // clip to today if started yesterday
      if (startMoment.isBefore(todayStart)) {
        elapsed = now.diff(todayStart, 'minute');
      }

      if (tl.apply_break_calculation) {
        const totalElapsed = now.diff(dayjs.utc(tl.start_timestamp), 'minute');
        elapsed = Math.max(0, elapsed - getBreakDeduction(totalElapsed));
      }

      activeMinutes += elapsed;
    }

    // Return only the extra on top of what the store already has
    return Math.max(0, activeMinutes - storedWorkedMinutes);
  }

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
    if (!base || !isDayToday || !selectedTargetId || $activeTimeLogs.length === 0) {
      return base;
    }
    const extra = computeActiveExtraMinutes(
      selectedTargetId,
      base.worked_minutes,
      $timers,
      $activeTimeLogs
    );
    if (extra <= 0) return base;
    return { ...base, worked_minutes: base.worked_minutes + extra };
  })());

  const selectedMonthBalance = $derived(
    selectedTargetId ? balancesMonthByTargetId.get(selectedTargetId) || null : null
  );
  const selectedYearBalance = $derived(
    selectedTargetId ? balancesYearByTargetId.get(selectedTargetId) || null : null
  );

  async function load() {
    loading = true;
    error = null;

    try {
      const [dayRes, monthRes, yearRes] = await Promise.all([
        loadBalancesByTargetId({ granularity: 'day', period: periods.day }),
        loadBalancesByTargetId({ granularity: 'month', period: periods.month }),
        loadBalancesByTargetId({ granularity: 'year', period: periods.year }),
      ]);

      balancesDayByTargetId = dayRes.balancesByTargetId;
      balancesMonthByTargetId = monthRes.balancesByTargetId;
      balancesYearByTargetId = yearRes.balancesByTargetId;

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
      <BalanceDisplay granularity="month" target={selectedTarget} balance={selectedMonthBalance} />
      <BalanceDisplay granularity="year" target={selectedTarget} balance={selectedYearBalance} />
    </div>
  {/if}
</div>
