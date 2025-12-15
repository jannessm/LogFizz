import { buttonsStore } from "src/stores/buttons";
import { timeLogsStore } from "src/stores/timelogs";
import { targetsStore } from "src/stores/targets";
import { balancesStore } from "src/stores/monthly-balances";

export async function loadData(isAuthenticated: boolean) {
    if (!isAuthenticated) {
        return;
    }

    const parallel = [
        buttonsStore.load(),
        targetsStore.load(), // fetches holidays as well
        balancesStore.load(),
    ];

    await Promise.all(parallel);

    await timeLogsStore.load(); // needs monthly balances for writing actions
}