// User types
export interface User {
  id: string;
  email: string;
  name: string;
  email_verified_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface State {
  id: string;
  country: string;
  state: string;
  code: string; // e.g., 'DE-BW' for Baden-Württemberg
}

// Button types
export interface Button {
  id: string;
  user_id: string;
  name: string;
  emoji?: string;
  color?: string;
  position: number;
  icon?: string;
  goal_time_minutes?: number;
  goal_days?: number[]; // Array of weekday numbers (0=Sunday, 1=Monday, etc.)
  auto_subtract_breaks: boolean;
  target_id?: string; // Optional assignment to a daily target
  created_at: string;
}

// Daily Target types
export interface DailyTarget {
  id: string;
  user_id: string;
  name: string;
  duration_minutes: number[]; // Array of duration values (one per weekday if needed)
  weekdays: number[]; // Array of weekday numbers (0=Sunday, 1=Monday, etc.)
  exclude_holidays: boolean; // Whether to exclude public holidays from target calculation
  state_id?: string;
  starting_from?: string; // Date from which tracking starts (important for saldo computations)
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

// TimeLog types - Event-based system
// Each TimeLog represents a single event (start or stop), not a time range
export interface TimeLog {
  id: string;
  user_id: string;
  button_id: string;
  type: 'start' | 'stop'; // Event type
  timestamp: string; // When this event occurred
  timezone?: string;
  apply_break_calculation: boolean;
  notes?: string;
  is_manual: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string; // Soft delete support
}

// Holiday types
export interface Holiday {
  id: string;
  country: string;
  date: string;
  name: string;
  year: number;
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
  type: 'button' | 'timelog' | 'target';
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
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
