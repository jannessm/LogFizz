/**
 * Frontend types - re-exported from shared lib package
 */
import type { TargetSpec } from '../../../lib/types/index.js';

export { dayjs, userTimezone } from '../../../lib/utils/dayjs';
export type {
  User,
  UserSettings,
  State,
  Timer,
  Balance,
  TimeLog,
  TimeLogType,
  Holiday,
  HolidayMetadata,
  ApiResponse,
  SyncQueueItem,
  GoalProgress,
  TargetSpec,
  BalanceCalcMeta,
} from '../../../lib/types/index.js';

// Extended Target type that includes nested target_specs from backend
// Backend sends Target with joined target_specs array
export interface TargetWithSpecs {
  id: string;
  user_id: string;
  name: string;
  target_specs: TargetSpec[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}
