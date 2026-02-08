import { timeLogsStore } from "../stores/timelogs";
import type { TimeLog } from "../types";

export async function saveTimelog(
  newLog: TimeLog,
  existingLog: TimeLog | null = null,
  timerToStop: TimeLog | null = null,
) {
  // If this is a timer being stopped (timerToStop is set), stop it with the notes and custom end time
  if (timerToStop) {
    await timeLogsStore.stopTimer(
      timerToStop,
      newLog.notes || undefined,
      newLog.end_timestamp || undefined
    );
    return {timerToStop: null};
  } else if (existingLog) {
    // Editing existing timelog
    await timeLogsStore.update(existingLog.id, {
      type: newLog.type,
      whole_day: newLog.whole_day,
      start_timestamp: newLog.start_timestamp,
      end_timestamp: newLog.end_timestamp || undefined,
      apply_break_calculation: newLog.apply_break_calculation,
      notes: newLog.notes || undefined,
    });
  } else {
    // Creating new timelog
    await timeLogsStore.create(newLog);
  }
}

export function deleteTimelog(timelog?: TimeLog) {
  if (timelog && timelog.id) {
    timeLogsStore.delete(timelog);
  }
}
