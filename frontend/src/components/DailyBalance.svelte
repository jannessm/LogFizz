<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { DailyTarget } from '../types';
  import { targetsStore } from '../stores/targets';
  import { buttonsStore } from '../stores/buttons';
  import { timeLogsStore } from '../stores/timelogs';
  import { formatMinutes, formatHours, getBalanceColor } from '../../../lib/utils/timeFormat.js';
  import dayjs from 'dayjs';

  let balances: Map<string, { worked: number; due: number; balance: number; target: DailyTarget }> = new Map();
  let refreshTick = 0;
  let intervalId: number | undefined;

  function calculateDailyBalances() {
    const newBalances = new Map<string, { worked: number; due: number; balance: number; target: DailyTarget }>();
    const today = dayjs().startOf('day');
    const todayEnd = dayjs().endOf('day');
    const currentWeekday = today.day(); // 0 = Sunday, 1 = Monday, etc.

    for (const target of $targetsStore.targets) {
      // Skip if target doesn't apply today
      if (!target.weekdays.includes(currentWeekday)) {
        continue;
      }

      // Skip if target is deleted
      if (target.deleted_at) {
        continue;
      }

      // Skip if we're before the starting_from date
      if (target.starting_from && dayjs(target.starting_from).isAfter(today)) {
        continue;
      }

      // Skip if we're after the ending_at date
      if (target.ending_at && dayjs(target.ending_at).isBefore(today)) {
        continue;
      }

      // Get the target duration for today
      const todayIndex = target.weekdays.indexOf(currentWeekday);
      const targetDuration = todayIndex >= 0 ? target.duration_minutes[todayIndex] : (target.duration_minutes[0] || 0);

      // Find all buttons assigned to this target
      const assignedButtons = $buttonsStore.buttons.filter(b => b.target_id === target.id && !b.deleted_at);

      // Calculate worked time for today
      let workedMinutes = 0;
      let hasSpecialTypeForToday = false;
      
      for (const button of assignedButtons) {
        const buttonLogs = $timeLogsStore.timeLogs.filter(log => 
          log.button_id === button.id &&
          log.start_timestamp &&
          dayjs(log.start_timestamp).isAfter(today) &&
          dayjs(log.start_timestamp).isBefore(todayEnd)
        );

        for (const log of buttonLogs) {
          const logType = log.type || 'normal';
          
          if (logType !== 'normal') {
            // For special types (sick, holiday, business-trip, child-sick), count as target duration
            // Only count once even if there are multiple special type logs
            // Skip weekends (0 = Sunday, 6 = Saturday)
            if (!hasSpecialTypeForToday && currentWeekday !== 0 && currentWeekday !== 6) {
              workedMinutes += targetDuration;
              hasSpecialTypeForToday = true;
            }
          } else {
            // For normal logs, count actual worked time
            if (log.end_timestamp) {
              // Completed session
              if (log.duration_minutes !== undefined && log.duration_minutes !== null) {
                workedMinutes += log.duration_minutes;
              } else {
                const start = dayjs(log.start_timestamp);
                const end = dayjs(log.end_timestamp);
                workedMinutes += end.diff(start, 'minute', true);
              }
            } else {
              // Active session - calculate from start to now
              const start = dayjs(log.start_timestamp);
              workedMinutes += dayjs().diff(start, 'minute', true);
            }
          }
        }
      }

      const balanceMinutes = workedMinutes - targetDuration;

      newBalances.set(target.id, {
        worked: workedMinutes,
        due: targetDuration,
        balance: balanceMinutes,
        target: target
      });
    }

    balances = newBalances;
  }

  $: if ($targetsStore.targets && $buttonsStore.buttons && $timeLogsStore.timeLogs || refreshTick) {
    calculateDailyBalances();
  }

  // Check if there are any running sessions
  function hasRunningSessions(): boolean {
    return $timeLogsStore.activeTimers.length > 0;
  }

  // Set up interval to refresh running sessions every 5 seconds
  onMount(() => {
    if (hasRunningSessions()) {
      intervalId = window.setInterval(() => {
        if (hasRunningSessions()) {
          refreshTick++;
        } else if (intervalId) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      }, 5000); // Update every 5 seconds
    }
  });

  onDestroy(() => {
    if (intervalId) {
      window.clearInterval(intervalId);
    }
  });

  // Watch for timer changes to start/stop interval
  $: if ($timeLogsStore.activeTimers) {
    if (hasRunningSessions() && !intervalId) {
      intervalId = window.setInterval(() => {
        if (hasRunningSessions()) {
          refreshTick++;
        } else if (intervalId) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      }, 5000);
    } else if (!hasRunningSessions() && intervalId) {
      window.clearInterval(intervalId);
      intervalId = undefined;
    }
  }

  $: sortedBalances = Array.from(balances.values()).sort((a, b) => 
    a.target.name.localeCompare(b.target.name)
  );
</script>

{#if sortedBalances.length > 0}
  <div class="mb-4">
    <div class="bg-white rounded-lg shadow-md p-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Today's Balance</h3>
      
      <div class="space-y-3">
        {#each sortedBalances as { worked, due, balance, target } (target.id)}
          <div class="border border-gray-200 rounded-lg p-3">
            <div class="flex justify-between items-start mb-2">
              <div>
                <h4 class="font-medium text-gray-800">{target.name}</h4>
                {#if target.exclude_holidays}
                  <span class="text-xs text-gray-500">
                    (excluding public holidays)
                  </span>
                {/if}
              </div>
              <div class="text-right">
                <div class={`text-lg font-bold ${getBalanceColor(balance)}`}>
                  {formatMinutes(balance)}
                </div>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span class="text-gray-600">Worked:</span>
                <span class="font-medium text-gray-800 ml-1">{formatHours(worked)}</span>
              </div>
              <div>
                <span class="text-gray-600">Due:</span>
                <span class="font-medium text-gray-800 ml-1">{formatHours(due)}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Add any custom styles here */
</style>
