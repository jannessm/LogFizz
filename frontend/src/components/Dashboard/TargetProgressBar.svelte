<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { todayTargets } from '../../stores/targets';
  import { timers } from '../../stores/timers';
  import { timeLogsStore } from '../../stores/timelogs';
  import { holidaysStore } from '../../stores/holidays';
  import { mapToArray } from '../../stores/base-store';
  import { calculateDueMinutes, calculateWorkedMinutesForDate } from '../../../../lib/utils/balance.js';
  import { dayjs } from '../../types';
  import { _ } from '../../lib/i18n';
  import { formatMinutesCompact } from '../../../../lib/utils/timeFormat.js';
  import type { TimeLog } from '../../types';

  /**
   * Computes a break deduction for an active (running) timelog given the total
   * elapsed minutes so far according to German break rules.
   * The real break calculation in balance.ts only applies once the log is
   * complete. Here we mirror the same thresholds so the estimate is consistent.
   */
  function getBreakDeduction(elapsedMinutes: number): number {
    if (elapsedMinutes >= 9 * 60) return 45;
    if (elapsedMinutes >= 6 * 60) return 30;
    return 0;
  }

  interface TargetProgress {
    targetId: string;
    targetName: string;
    dueMinutes: number;
    workedMinutes: number;
    percentage: number;
    /** Estimated wall-clock time when the target will be completed (dayjs object), or null */
    estimatedCompletion: ReturnType<typeof dayjs> | null;
    /** Whether the target has already been reached */
    done: boolean;
  }

  let progressList = $state<TargetProgress[]>([]);
  let tickInterval: number | null = null;

  function buildProgressList(): TargetProgress[] {
    const today = dayjs().format('YYYY-MM-DD');
    const allTimers = get(timers);
    const allTimelogs = mapToArray(get(timeLogsStore).items).filter(tl => !tl.deleted_at);
    const todayStr = today;

    // active (running) timelogs – no end_timestamp
    const activeTimelogs = allTimelogs.filter(tl => !tl.end_timestamp);

    const result: TargetProgress[] = [];

    for (const target of get(todayTargets)) {
      // Build holidays set for this target
      const holidaysSet = new Set<string>();
      for (const spec of target.target_specs || []) {
        if (spec.exclude_holidays && spec.state_code) {
          const country = spec.state_code.split('-')[0];
          const year = dayjs().year();
          const month = dayjs().month() + 1;
          const holidays = holidaysStore.getHolidaysForMonth(country, year, month);
          holidays.forEach(h => holidaysSet.add(h.date));
        }
      }

      const dueMinutes = calculateDueMinutes(todayStr, target as any, holidaysSet);
      if (dueMinutes <= 0) continue;

      // Find timers linked to this target
      const linkedTimerIds = new Set(
        allTimers.filter(t => t.target_id === target.id).map(t => t.id)
      );

      // Timelogs for today belonging to this target (completed ones)
      const completedTodayLogs = allTimelogs.filter(tl => {
        if (!tl.end_timestamp) return false;
        if (!linkedTimerIds.has(tl.timer_id)) return false;
        // Check if log overlaps today
        const logDate = dayjs.utc(tl.start_timestamp).local().format('YYYY-MM-DD');
        const endDate = dayjs.utc(tl.end_timestamp).local().format('YYYY-MM-DD');
        return logDate === todayStr || endDate === todayStr;
      });

      const { worked_minutes: workedFromCompleted } = calculateWorkedMinutesForDate(
        todayStr,
        completedTodayLogs as TimeLog[],
        dueMinutes
      );

      // Add minutes from currently running timelogs (real-time)
      let workedFromActive = 0;
      let activeLog: TimeLog | undefined;

      for (const tl of activeTimelogs) {
        if (!linkedTimerIds.has(tl.timer_id)) continue;
        activeLog = tl as TimeLog;

        const startMoment = dayjs.utc(tl.start_timestamp);
        const nowMoment = dayjs.utc();
        let elapsed = nowMoment.diff(startMoment, 'minute');

        // Clip to today start if timelog started yesterday
        const todayStart = dayjs().startOf('day').utc();
        if (startMoment.isBefore(todayStart)) {
          elapsed = nowMoment.diff(todayStart, 'minute');
        }

        if (tl.apply_break_calculation) {
          // For an active log we need to estimate breaks based on total elapsed since start
          const totalElapsed = nowMoment.diff(dayjs.utc(tl.start_timestamp), 'minute');
          const breakDeduction = getBreakDeduction(totalElapsed);
          elapsed = Math.max(0, elapsed - breakDeduction);
        }

        workedFromActive += elapsed;
      }

      const totalWorked = workedFromCompleted + workedFromActive;
      const percentage = dueMinutes > 0 ? Math.min(100, (totalWorked / dueMinutes) * 100) : 0;
      const done = totalWorked >= dueMinutes;

      // Estimate completion time
      let estimatedCompletion: ReturnType<typeof dayjs> | null = null;

      if (!done && activeLog) {
        const remainingMinutes = dueMinutes - totalWorked;
        // We need to add `remainingMinutes` of *net* work time.
        // If breaks apply, the wall-clock time needed might be longer.
        let wallClockRemaining = remainingMinutes;

        if (activeLog.apply_break_calculation) {
          // Current total elapsed since start of active log
          const startMoment = dayjs.utc(activeLog.start_timestamp);
          const nowMoment = dayjs.utc();
          const totalElapsedSoFar = nowMoment.diff(startMoment, 'minute');

          // Check if an additional break threshold will be crossed
          const currentBreak = getBreakDeduction(totalElapsedSoFar);
          const futureElapsed = totalElapsedSoFar + remainingMinutes;
          const futureBreak = getBreakDeduction(futureElapsed);
          const additionalBreak = futureBreak - currentBreak;

          // Add the extra break time to the wall-clock estimate
          wallClockRemaining = remainingMinutes + additionalBreak;
        }

        estimatedCompletion = dayjs().add(wallClockRemaining, 'minute');
      }

      result.push({
        targetId: target.id,
        targetName: target.name,
        dueMinutes,
        workedMinutes: Math.round(totalWorked),
        percentage,
        estimatedCompletion,
        done,
      });
    }

    return result;
  }

  function refresh() {
    progressList = buildProgressList();
  }

  onMount(() => {
    refresh();
    // Refresh every 1 second for live updates
    tickInterval = window.setInterval(refresh, 1000);
  });

  onDestroy(() => {
    if (tickInterval !== null) {
      window.clearInterval(tickInterval);
    }
  });

  // Also refresh when stores change
  const _unsub1 = todayTargets.subscribe(() => refresh());
  const _unsub2 = timeLogsStore.subscribe(() => refresh());

  onDestroy(() => {
    _unsub1();
    _unsub2();
  });
</script>

{#if progressList.length > 0}
  <div class="flex flex-col gap-1.5 px-4 pt-2 pb-1">
    {#each progressList as progress (progress.targetId)}
      <div class="flex flex-col gap-0.5">

        <!-- Bar row: name · bar · percentage -->
        <div class="flex items-center gap-2 text-m text-gray-500 dark:text-gray-400">
          <span class="shrink-0 max-w-[30%] truncate">{progress.targetName}</span>
          <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              class:bg-primary={!progress.done}
              class:bg-green-500={progress.done}
              style="width: {progress.percentage}%"
            ></div>
          </div>
          <span
            class="tabular-nums shrink-0 w-9 text-right"
            class:text-green-600={progress.done}
            class:dark:text-green-400={progress.done}
          >
            {Math.round(progress.percentage)}%
          </span>
        </div>

        <!-- Detail row: worked / due · estimated completion -->
        <div class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pl-0">
          <span class="tabular-nums">
            {formatMinutesCompact(progress.workedMinutes)} / {formatMinutesCompact(progress.dueMinutes)}
          </span>
          {#if progress.estimatedCompletion}
            <span class="tabular-nums">≈ {progress.estimatedCompletion.format('HH:mm')}</span>
          {/if}
        </div>

      </div>
    {/each}
  </div>
{/if}
