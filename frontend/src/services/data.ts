import { timersStore } from "../stores/timers";
import { timeLogsStore } from "../stores/timelogs";
import { targetsStore } from "../stores/targets";
import { balancesStore } from "../stores/balances";
import { getAllTimeLogs, getBalancesCount } from "../lib/db";

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
        await initializeBalances();
    }
}

 /**
   * Initialize balances from the earliest timelog onwards
   * Called after first timelog sync to ensure balances are calculated
   */
  async function initializeBalances(): Promise<void> {
    try {
      console.log('Initializing balances from timelogs...');
      
      // Get all timelogs to check if we have any data
      const allTimelogs = await getAllTimeLogs();
      
      if (allTimelogs.length === 0) {
        console.log('No timelogs found, skipping balance initialization');
        return;
      }

      // Recalculate all balances for all targets
      await balancesStore.recalculateBalances();

      console.log('Balance initialization complete');
    } catch (error) {
      console.error('Error initializing balances from timelogs:', error);
    }
  }
