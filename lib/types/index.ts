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
  subscription_status?: 'trial' | 'active' | 'expired' | 'canceled';
  subscription_end_date?: string;
  trial_end_date?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
}

// User Settings types
export type StatsMailFrequency = 'never' | 'weekly' | 'monthly';

export interface UserSettings {
  id: string;
  user_id: string;
  language: string; // 'en' | 'de'
  locale: string; // Locale for date/time formatting e.g., 'en-US', 'de-DE'
  first_day_of_week: 'sunday' | 'monday'; // Starting day of the week in calendar views
  stats_mail_frequency: StatsMailFrequency; // How often to send stats emails
  created_at: string;
  updated_at: string;
}

export interface UserSettingsEntity extends Omit<UserSettings, 'created_at' | 'updated_at'> {
  created_at: Date;
  updated_at: Date;
}

export interface State {
  code: string; // e.g., 'DE-BW' for Baden-Württemberg (primary key)
  country: string;
  state: string;
}

// Timer types
export interface Timer {
  id: string;
  user_id: string;
  name: string;
  emoji?: string;
  color?: string;
  auto_subtract_breaks: boolean;
  archived: boolean;
  target_id?: string | null; // Optional: link to Target for balance calculation
  goal_time_minutes?: number; // Optional: daily goal for this timer
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Target types
export interface Target {
  id: string;
  user_id: string;
  name: string;
  target_spec_ids: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Duration Spec types (without timestamps - only in entity)
export interface TargetSpec {
  id: string;
  user_id: string;
  target_id: string;
  starting_from: string;
  ending_at?: string;
  duration_minutes: number[]; // 7-entry array for Sun-Sat (indices 0-6)
  exclude_holidays: boolean;
  state_code?: string;
}

// Balance types
export interface Balance {
  id: string; // Composite ID format: {target_id}_{date}
  user_id: string;
  target_id: string;

  date: string; // year, year-month, or year-month-date
  due_minutes: number;
  worked_minutes: number;
  cumulative_minutes: number;

  sick_days: number;
  holidays: number;
  business_trip: number;
  child_sick: number;
  homeoffice: number;
  worked_days: number;
  
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Generate a deterministic balance ID from target_id and date
 * @param targetId - The target ID (UUID)
 * @param date - The date string (YYYY, YYYY-MM, or YYYY-MM-DD)
 * @returns Composite ID in format {target_id}_{date}
 */
export function generateBalanceId(targetId: string, date: string): string {
  return `${targetId}_${date}`;
}

/**
 * Parse a composite balance ID into its components
 * @param id - The composite balance ID
 * @returns Object with targetId and date, or null if invalid
 */
export function parseBalanceId(id: string): { targetId: string; date: string } | null {
  const lastUnderscoreIndex = id.lastIndexOf('_');
  if (lastUnderscoreIndex === -1) return null;
  
  return {
    targetId: id.substring(0, lastUnderscoreIndex),
    date: id.substring(lastUnderscoreIndex + 1)
  };
}

// TimeLog type enum
export type TimeLogType = 'normal' | 'sick' | 'holiday' | 'business-trip' | 'child-sick' | 'homeoffice';

// TimeLog types - Time range based system
// Each TimeLog represents a time tracking session with start/end timestamps
export interface TimeLog {
  id: string;
  user_id: string;
  timer_id: string;
  type: TimeLogType; // Type of timelog entry
  whole_day: boolean;
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

/**
 * Metadata for balance calculation state
 * Stored in local storage to track which balances are up-to-date
 */
export interface BalanceCalcMeta {
  schema_version: 1;
  user_id: string;
  targets: Record<string, {
    /** Last day (YYYY-MM-DD) for which balances are fully derived */
    last_updated_day: string;
    /** Timestamp when metadata was last updated */
    updated_at: string;
  }>;
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
  type: 'timer' | 'timelog' | 'target' | 'balance';
  data: any;
  synced: boolean;
  error?: string;
}

// Goal progress type
export interface GoalProgress {
  timer_id: string;
  date: string;
  goal_minutes: number;
  actual_minutes: number;
  achieved: boolean;
  percentage: number;
}

// Database entity variants (for backend use with Date objects)
// These are used by TypeORM entities where Date objects are needed

export interface TimerEntity extends Omit<Timer, 'created_at' | 'updated_at' | 'deleted_at'> {
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface TargetEntity extends Omit<Target, 'created_at' | 'updated_at' | 'deleted_at'> {
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface TargetSpecEntity extends Omit<TargetSpec, 'starting_from' | 'ending_at'> {
  starting_from: Date;
  ending_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface TimeLogEntity extends Omit<TimeLog, 'start_timestamp' | 'end_timestamp' | 'created_at' | 'updated_at' | 'deleted_at'> {
  start_timestamp: Date;
  end_timestamp?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface BalanceEntity extends Omit<Balance, 'created_at' | 'updated_at' | 'deleted_at'> {
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface UserEntity extends Omit<User, 'created_at' | 'updated_at' | 'deleted_at' | 'email_verified_at' | 'subscription_end_date' | 'trial_end_date'> {
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  email_verified_at?: Date;
  email_verification_token?: string;
  email_verification_expires_at?: Date;
  reset_token?: string;
  reset_token_expires_at?: Date;
  subscription_end_date?: Date;
  trial_end_date?: Date;
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
