/**
 * Shared type definitions for frontend and backend
 * These types represent the business domain model
 */

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface State {
  code: string; // e.g., 'DE-BW' for Baden-Württemberg (primary key)
  country: string;
  state: string;
}

// Button types
export interface Button {
  id: string;
  user_id: string;
  name: string;
  emoji?: string;
  color?: string;
  auto_subtract_breaks: boolean;
  archived: boolean;
  target_id?: string; // Optional assignment to a daily target
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Daily Target types
export interface DailyTarget {
  id: string;
  user_id: string;
  name: string;
  duration_minutes: number[]; // Array of duration values (one per weekday if needed)
  weekdays: number[]; // Array of weekday numbers (0=Sunday, 1=Monday, etc.)
  exclude_holidays: boolean; // Whether to exclude public holidays from target calculation
  state_code?: string;
  starting_from?: string; // Date from which tracking starts (important for saldo computations)
  ending_at?: string; // Date at which tracking ends (balance calculated only up to this date)
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Monthly Balance types
export interface MonthlyBalance {
  id: string;
  user_id: string;
  target_id: string;
  year: number;
  month: number; // 1-12
  worked_minutes: number;
  due_minutes: number;
  balance_minutes: number;
  exclude_holidays: boolean;
  created_at: string;
  updated_at: string;
  target?: DailyTarget;
}

// TimeLog type enum
export type TimeLogType = 'normal' | 'sick' | 'holiday' | 'business-trip' | 'child-sick';

// TimeLog types - Time range based system
// Each TimeLog represents a time tracking session with start/end timestamps
export interface TimeLog {
  id: string;
  user_id: string;
  button_id: string;
  type: TimeLogType; // Type of timelog entry
  start_timestamp: string; // When the session started
  end_timestamp?: string; // When the session ended (null if still running)
  duration_minutes?: number; // Auto-calculated when end_timestamp is set
  timezone: string;
  apply_break_calculation: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string; // Soft delete support
  month?: number; // 1-12 for indexing
  year?: number; // Full year for indexing
}

// Holiday types
export interface Holiday {
  id: string;
  country: string;
  global: boolean;
  counties: string[];
  date: string;
  name: string;
  year: number;
}

export interface HolidayMetadata {
  id: string;
  country: string;
  year: number;
  last_updated: string;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Sync types for offline-first
export interface SyncQueueItem {
  id: string;
  type: 'button' | 'timelog' | 'target' | 'monthlyBalance';
  data: any;
  synced: boolean;
  error?: string;
}

// Goal progress type
export interface GoalProgress {
  button_id: string;
  date: string;
  goal_minutes: number;
  actual_minutes: number;
  achieved: boolean;
  percentage: number;
}

// Statistics types
export interface YearlyStats {
  button_id: string;
  button_name: string;
  total_minutes: number;
  total_hours: number;
  entry_count: number;
}

// Database entity variants (for backend use with Date objects)
// These are used by TypeORM entities where Date objects are needed

export interface ButtonEntity extends Omit<Button, 'created_at' | 'updated_at' | 'deleted_at'> {
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface DailyTargetEntity extends Omit<DailyTarget, 'starting_from' | 'ending_at' | 'created_at' | 'updated_at' | 'deleted_at'> {
  starting_from?: Date;
  ending_at?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface TimeLogEntity extends Omit<TimeLog, 'start_timestamp' | 'end_timestamp' | 'created_at' | 'updated_at' | 'deleted_at'> {
  start_timestamp: Date;
  end_timestamp?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface MonthlyBalanceEntity extends Omit<MonthlyBalance, 'created_at' | 'updated_at' | 'target'> {
  created_at: Date;
  updated_at: Date;
  target?: DailyTargetEntity;
}

export interface UserEntity extends Omit<User, 'created_at' | 'updated_at' | 'deleted_at' | 'email_verified_at'> {
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  email_verified_at?: Date;
  email_verification_token?: string;
  email_verification_expires_at?: Date;
  reset_token?: string;
  reset_token_expires_at?: Date;
}

export interface HolidayEntity extends Omit<Holiday, 'date'> {
  date: Date;
}
export interface HolidayData extends Omit<HolidayEntity, 'id'> {}

export interface HolidayMetadataEntity extends Omit<HolidayMetadata, 'last_updated'> {
  last_updated: Date;
}

export interface StateEntity {
  code: string; // Primary key
  country: string;
  state: string;
}
