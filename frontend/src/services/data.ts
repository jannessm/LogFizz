import { timersStore } from "../stores/timers";
import { activeTimeLogs, timeLogsStore } from "../stores/timelogs";
import { targetsStore } from "../stores/targets";
import { balancesStore } from "../stores/balances";
import { get } from "svelte/store";

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
    console.log('Time logs loaded', get(timeLogsStore).items);
}