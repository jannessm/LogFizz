import { timersStore } from "../stores/timers";
import { timeLogsStore } from "../stores/timelogs";
import { targetsStore } from "../stores/targets";
import { balancesStore } from "../stores/balances";
import { getAllTimeLogs, getBalancesCount, getAllBalances } from "../lib/db";
import dayjs from "../../../lib/utils/dayjs.js";

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

    const balanceCount = await getBalancesCount();
    
    if (balanceCount === 0) {
        console.log("No balances found, initializing from timelogs...");
        await initializeBalances();
    } else {
        // Ensure balances exist up to today
        await ensureBalancesUpToToday();
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

/**
 * Ensure balances exist up to today for all targets
 * Called when balances already exist to fill in any gaps
 */
async function ensureBalancesUpToToday(): Promise<void> {
  try {
    console.log('Ensuring balances are up to date...');
    
    // Get all existing balances to find the latest date
    const allBalances = await getAllBalances();
    
    if (allBalances.length === 0) {
      return;
    }

    // Find the latest daily balance date for each target
    const dailyBalances = allBalances.filter(b => b.date.length === 10); // YYYY-MM-DD format
    
    if (dailyBalances.length === 0) {
      console.log('No daily balances found, recalculating all balances');
      await balancesStore.recalculateBalances();
      return;
    }

    // Group by target_id and find the latest date for each
    const latestByTarget = new Map<string, string>();
    for (const balance of dailyBalances) {
      const currentLatest = latestByTarget.get(balance.target_id);
      if (!currentLatest || balance.date > currentLatest) {
        latestByTarget.set(balance.target_id, balance.date);
      }
    }

    const today = dayjs().format('YYYY-MM-DD');
    let needsUpdate = false;

    // Check if any target needs balances calculated up to today
    for (const [targetId, latestDate] of latestByTarget.entries()) {
      if (latestDate < today) {
        needsUpdate = true;
        console.log(`Target ${targetId} has balances only up to ${latestDate}, calculating up to today`);
        
        // Calculate missing balances from the day after latest to today
        const startDate = dayjs(latestDate).add(1, 'day');
        const endDate = dayjs(today);
        
        const startYear = startDate.year();
        const startMonth = startDate.month() + 1;
        const endYear = endDate.year();
        const endMonth = endDate.month() + 1;

        // Calculate daily balances for all months from start to end
        for (let year = startYear; year <= endYear; year++) {
          const firstMonth = year === startYear ? startMonth : 1;
          const lastMonth = year === endYear ? endMonth : 12;

          for (let month = firstMonth; month <= lastMonth; month++) {
            await balancesStore.calculateDailyBalances(targetId, year, month);
          }
        }

        // Recalculate monthly balances
        for (let year = startYear; year <= endYear; year++) {
          const firstMonth = year === startYear ? startMonth : 1;
          const lastMonth = year === endYear ? endMonth : 12;

          for (let month = firstMonth; month <= lastMonth; month++) {
            await balancesStore.recalculateMonthlyBalance(targetId, year, month);
          }
        }

        // Calculate yearly balances
        for (let year = startYear; year <= endYear; year++) {
          await balancesStore.recalculateYearlyBalance(targetId, year);
        }
      }
    }

    if (!needsUpdate) {
      console.log('All balances are up to date');
    } else {
      console.log('Balance update complete');
    }
  } catch (error) {
    console.error('Error ensuring balances up to today:', error);
  }
}
