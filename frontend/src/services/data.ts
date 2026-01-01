import { timersStore } from "../stores/timers";
import { timeLogsStore } from "../stores/timelogs";
import { targetsStore } from "../stores/targets";
import { balancesStore } from "../stores/balances";
import { getAllTimeLogs, getBalancesCount } from "../lib/db";
import { dayjs, type TargetWithSpecs, type TimeLog } from "../types";
import { get } from "svelte/store";
import { recalculateBalancesForTimeLog } from "../utils/balance-recalculation";

export async function loadData(isAuthenticated: boolean) {
    if (!isAuthenticated) {
        return;
    }

    const parallel = [
        timersStore.load(),
        targetsStore.load(), // fetches holidays as well
        balancesStore.load(),
    ];

    await Promise.all(parallel);

    await timeLogsStore.load(); // needs balances for writing actions

    if (await getBalancesCount() === 0) {
        console.log("No balances found, initializing from timelogs...");
        await initializeBalancesFromTimelogs();
    }
}

 /**
   * Initialize balances from the earliest timelog onwards
   * Called after first timelog sync to ensure balances are calculated
   */
  async function initializeBalancesFromTimelogs(): Promise<void> {
    try {
      console.log('Initializing balances from timelogs...');
      
      // Get all timelogs to find the earliest one
      const allTimelogs = await getAllTimeLogs(); // get all from db directly, store only load current month
      const targets = await get(targetsStore).items;
      const targetMap = new Map<string, TargetWithSpecs>();
      for (const target of targets) {
        targetMap.set(target.id, target);
      }
      
      if (allTimelogs.length === 0) {
        console.log('No timelogs found, skipping balance initialization');
        return;
      }

      // Sort by start_timestamp to find earliest
      // Create a map from target_id to earliest timelog start time
      const targetEarliestMap = new Map<TargetWithSpecs, TimeLog>();
      const timersToTargets = new Map<string, string>();

      const timers = await get(timersStore).items;
      for (const timer of timers) {
        if (timer.target_id) {
          timersToTargets.set(timer.id, timer.target_id);
        }
      }
      
      for (const timelog of allTimelogs) {
        if (timelog.timer_id) {
          const target = targetMap.get(timersToTargets.get(timelog.timer_id)!);
          if (!target) continue;

          const currentEarliest = targetEarliestMap.get(target);
          const timelogStart = dayjs(timelog.start_timestamp);

          if (!currentEarliest || timelogStart.isBefore(currentEarliest.start_timestamp)) {
            targetEarliestMap.set(target, timelog);
          }
        }
      }

      // Recalculate balances for each timelog starting from the earliest
      const promises = [];
      for (const [target, timelog] of targetEarliestMap.entries()) {
        promises.push(recalculateBalancesForTimeLog(timelog, [target]));
      }
      await Promise.all(promises);

      console.log('Balance initialization complete');
    } catch (error) {
      console.error('Error initializing balances from timelogs:', error);
    }
  }
