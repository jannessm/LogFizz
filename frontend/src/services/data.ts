import { timersStore } from "../stores/timers";
import { timeLogsStore } from "../stores/timelogs";
import { targetsStore } from "../stores/targets";
import { balancesStore } from "../stores/balances";
import { initLocaleFromSettings } from "../lib/dateFormatting";
import { userSettingsStore } from "../stores/userSettings";

export async function loadData(isAuthenticated: boolean) {
    if (!isAuthenticated) {
        return;
    }

    const parallel = [
        timersStore.load(),
        targetsStore.load(), // fetches holidays as well
        balancesStore.load(),
        userSettingsStore.init(),
    ];

    await Promise.all(parallel);

    await timeLogsStore.load(); // needs balances for writing actions

    // Unified balance initialization/update - handles:
    // - First-time init (no balances exist)
    // - Extension (balances exist but < today)
    // - No-op (balances already up to date)
    await balancesStore.init();

    initLocaleFromSettings();
}
