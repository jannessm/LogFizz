import { timersStore } from "../stores/timers";
import { timeLogsStore } from "../stores/timelogs";
import { targetsStore } from "../stores/targets";
import { balancesStore } from "../stores/balances";
import { initLocaleFromSettings } from "../lib/dateFormatting";
import { userSettingsStore } from "../stores/userSettings";
import { syncService } from './sync';
import { ensureTimelogDateIndex } from '../lib/db';

syncService.afterSourceSync(async (changed) => {
    await Promise.all([timersStore.load(false), targetsStore.load(false), balancesStore.load(false)]);
    await balancesStore.init(changed);
});

export async function loadData(isAuthenticated: boolean) {
    if (!isAuthenticated) {
        return;
    }

    const parallel = [
        timersStore.load(false),
        targetsStore.load(false), // fetches holidays as well
        balancesStore.load(false),
        userSettingsStore.init(),
    ];

    await Promise.all(parallel);

    await ensureTimelogDateIndex();
    await timeLogsStore.load(false);
    await syncService.sync('all');

    // Unified balance initialization/update - handles:
    // - First-time init (no balances exist)
    // - Extension (balances exist but < today)
    // - No-op (balances already up to date)
    await balancesStore.init();

    initLocaleFromSettings();
}
