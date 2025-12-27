/**
 * Frontend types - re-exported from shared lib package
 * This file maintains backwards compatibility for existing frontend imports
 */
import type { TargetSpec } from '../../../lib/types/index.js';

export type {
  User,
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
} from '../../../lib/types/index.js';

// Extended Target type that includes nested target_specs from backend
// Backend sends Target with joined target_specs array - no separate target_spec_ids needed
export interface TargetWithSpecs {
  id: string;
  user_id: string;
  name: string;
  target_specs: TargetSpec[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}
