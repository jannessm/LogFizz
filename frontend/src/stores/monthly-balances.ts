import { derived, get } from 'svelte/store';
import type { MonthlyBalance } from '../types';
import { getAllMonthlyBalances, saveMonthlyBalance, deleteMonthlyBalance, getMonthlyBalancesByYearMonth, getTimeLogsByYearMonth } from '../lib/db';
import { syncService } from '../services/sync';
import { createBaseStore, type BaseStoreConfig } from './base-store';
import dayjs from '../../../lib/utils/dayjs.js';
import { onlyUnique } from '../../../lib/utils/helper.js';
import { buttons } from './buttons';
import { targets } from './targets';
import { holidaysStore } from './holidays';
import type { DailyTarget, Holiday, TimeLog, Button } from '../../../lib/types';
import { balanceNeedsRecalculation, calculateMonthlyBalance } from '@clock/shared/monthlyBalance';

// Configure the base store for monthly balances
const monthlyBalances: BaseStoreConfig<MonthlyBalance> = {
  db: {
    getAll: getAllMonthlyBalances,
    save: saveMonthlyBalance,
    delete: deleteMonthlyBalance,
  },
  sync: {
    queueUpsert: syncService.queueUpsertMonthlyBalance,
    queueDelete: syncService.queueDeleteMonthlyBalance,
    syncType: 'monthlyBalance',
  },
  storeName: 'monthlyBalances',
};

// Create the base store
const baseStore = createBaseStore<MonthlyBalance>(monthlyBalances);

// Create the buttons store with custom create method
function createBalancesStore() {
  return {
    ...baseStore,

    async create(balanceData: Partial<MonthlyBalance>) {
      return baseStore.create({
        id: crypto.randomUUID(),
        user_id: '',
        target_id: balanceData.target_id || '',
        year: balanceData.year || dayjs().year(),
        month: balanceData.month || dayjs().month() + 1,
        worked_minutes: balanceData.worked_minutes || 0,
        due_minutes: balanceData.due_minutes || 0,
        balance_minutes: balanceData.balance_minutes || 0,
        exclude_holidays: balanceData.exclude_holidays || false,
        sick_days: balanceData.sick_days || 0,
        holidays: balanceData.holidays || 0,
        business_trip: balanceData.business_trip || 0,
        child_sick: balanceData.child_sick || 0,
        hash: balanceData.hash || '',
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString(),
      });
    },

    async getMonthlyBalancesByYearMonth(year: number, month: number): Promise<MonthlyBalance[]> {
      const {
        balances, balancesMap,
        timelogs,
        buttonsMap, targetsMap,
        holidays,
        _targets } = await loadDataForCalculation(year, month);

      const previousBalances = await this.getMonthlyBalancesByYearMonth(
        year,
        month - 1
      );

      const { balanceToTimelogs, missingTargets } = mapBalancesToTimeLogs(
        timelogs,
        balancesMap,
        buttonsMap,
        targetsMap
      );

      const finalBalances: MonthlyBalance[] = [];

      let updatedBalances = this.validateMonthlyBalances(balanceToTimelogs, targetsMap, holidays);
      updatedBalances = await Promise.all(updatedBalances.map(async b => await this.create(b)));
      finalBalances.push(...updatedBalances);

      // create missing balances for targets without balances
      for (const [targetId, logs] of missingTargets.entries()) {
        const target = _targets.find(t => t.id === targetId);

        if (!target) {
          console.error(`Target with ID ${targetId} not found for monthly balance calculation.`);
          continue;
        }

        let holidays = new Set<string>();
        if (target?.state_code) {
          holidays = new Set(holidaysStore.getHolidaysForMonth(
            target?.state_code?.split('-')[0] || '',
            year,
            month
          ).map(h => h.date));
        }

        const previousMonthBalance = previousBalances.find(b => b.target_id === targetId);

        const balance = await calculateMonthlyBalance(
          {
            target_id: targetId,
            year,
            month,
            exclude_holidays: target?.exclude_holidays || false,
          },
          target!,
          logs,
          holidays,
          previousMonthBalance
        );

        balances.push(await this.create(balance));
      }

      return balances;
    },

    async getMonthlyBalancesByTargetIdYearMonth(
      targetId: string,
      year: number,
      month: number
    ): Promise<MonthlyBalance | undefined> {
      const balances = await this.getMonthlyBalancesByYearMonth(year, month);
      return balances.find(b => b.target_id === targetId);
    },
  
    validateMonthlyBalances(
      balanceToTimelogs: Map<MonthlyBalance, TimeLog[]>,
      targetsMap: Map<string, DailyTarget>,
      holidays: Map<string, Set<string>>
    ): MonthlyBalance[] {
      const updatedBalances: MonthlyBalance[] = [];
      
      // check if balances are up to date
      for (const [balance, tls] of balanceToTimelogs.entries()) {
        if (balanceNeedsRecalculation(balance, tls)) {
          const target = targetsMap.get(balance.target_id);
          const holiday = holidays.get(balance.target_id) || new Set<string>();
          if (target) {
            const previousBalance = 
            calculateMonthlyBalance(balance, target, tls, holiday);

          }
        }
      }

      return updatedBalances;
    }
  };
}

export const balancesStore = createBalancesStore();

// Derived store for balances (maps 'items' to 'balances' for backward compatibility)
export const balances = derived(
  balancesStore,
  ($store) => $store.items
);





/** HELPER for monthly balance calculation */
async function loadDataForCalculation(year: number, month: number) {
  // get balances for specific year and month
  const balances = await getMonthlyBalancesByYearMonth(year, month);
  const balancesMap = new Map<string, MonthlyBalance>();
  balances.forEach(b => balancesMap.set(b.id, b));

  // get timelogs for balances
  const timelogs = await getTimeLogsByYearMonth(year, month);

  const _buttons = get(buttons);
  const buttonsMap = new Map<string, Button>();
  _buttons.forEach(b => buttonsMap.set(b.id, b));
  const _targets = get(targets) as DailyTarget[];
  const targetsMap = new Map<string, DailyTarget>();
  _targets.forEach(t => targetsMap.set(t.id, t));
  const states = _targets.map(t => t.state_code)
                          .filter(onlyUnique)
                          .filter(s => s !== undefined) as string[];

  const holidays = new Map<string, Set<string>>();
  for (const state of states) {
    const holidaysForState = holidaysStore.getHolidaysForMonth(state, year, month);
    holidays.set(state, new Set(holidaysForState.map(h => h.date)));
  }
  return { balances, balancesMap, timelogs, buttonsMap, targetsMap, holidays, _targets };
}

function mapBalancesToTimeLogs(
  timelogs: TimeLog[],
  balancesMap: Map<string, MonthlyBalance>,
  buttonsMap: Map<string, Button>,
  targetsMap: Map<string, DailyTarget>
) {
  // map timelogs to balances and
  // check if for each timelog there is a balance
  const balanceToTimelogs = new Map<MonthlyBalance, TimeLog[]>();
  const missingTargets = new Map<string, TimeLog[]>();
  const timelogTargetIds = new Map<string, string>();
  timelogs.forEach(tl => {
    const button = buttonsMap.get(tl.button_id);
    if (button && button.target_id) {
      timelogTargetIds.set(tl.id, button.target_id);
    }
  });

  // map timelogs to balances, or group timelogs by missing target
  timelogs.forEach(tl => {
    const targetId = timelogTargetIds.get(tl.id);
    if (targetId) {
      const balance = balancesMap.get(targetId);
      
      // balance found
      if (balance && balanceToTimelogs.has(balance)) {
        balanceToTimelogs.get(balance)?.push(tl);

      } else if (balance) {
        balanceToTimelogs.set(balance, [tl]);

      // balance missing, and targetId not yet in missingTargets
      } else if (!missingTargets.has(targetId)) {
        missingTargets.set(targetId, [tl]);
      
      // balance missing, but targetId already in missingTargets
      } else if (missingTargets.has(targetId)) {
        missingTargets.get(targetId)?.push(tl);
      }
    }
  });
  return { balanceToTimelogs, missingTargets };
}
