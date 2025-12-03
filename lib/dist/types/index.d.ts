/**
 * Shared type definitions for frontend and backend
 * These types represent the business domain model
 */
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
    code: string;
    country: string;
    state: string;
}
export interface Button {
    id: string;
    user_id: string;
    name: string;
    emoji?: string;
    color?: string;
    auto_subtract_breaks: boolean;
    target_id?: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}
export interface DailyTarget {
    id: string;
    user_id: string;
    name: string;
    duration_minutes: number[];
    weekdays: number[];
    exclude_holidays: boolean;
    state_code?: string;
    starting_from?: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}
export interface MonthlyBalance {
    id: string;
    user_id: string;
    target_id: string;
    year: number;
    month: number;
    worked_minutes: number;
    due_minutes: number;
    balance_minutes: number;
    exclude_holidays: boolean;
    created_at: string;
    updated_at: string;
    target?: DailyTarget;
}
export interface TimeLog {
    id: string;
    user_id: string;
    button_id: string;
    start_timestamp: string;
    end_timestamp?: string;
    duration_minutes?: number;
    timezone: string;
    apply_break_calculation: boolean;
    notes?: string;
    is_manual: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}
export interface Holiday {
    id: string;
    country: string;
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
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}
export interface SyncQueueItem {
    id: string;
    type: 'button' | 'timelog' | 'target';
    operation: 'create' | 'update' | 'delete';
    data: any;
    timestamp: number;
    synced: boolean;
    error?: string;
}
export interface GoalProgress {
    button_id: string;
    date: string;
    goal_minutes: number;
    actual_minutes: number;
    achieved: boolean;
    percentage: number;
}
export interface YearlyStats {
    button_id: string;
    button_name: string;
    total_minutes: number;
    total_hours: number;
    entry_count: number;
}
export interface ButtonEntity extends Omit<Button, 'created_at' | 'updated_at' | 'deleted_at'> {
    created_at: Date;
    updated_at: Date;
    deleted_at?: Date;
}
export interface DailyTargetEntity extends Omit<DailyTarget, 'starting_from' | 'created_at' | 'updated_at' | 'deleted_at'> {
    starting_from?: Date;
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
export interface HolidayMetadataEntity extends Omit<HolidayMetadata, 'last_updated'> {
    last_updated: Date;
}
export interface StateEntity {
    code: string;
    country: string;
    state: string;
}
//# sourceMappingURL=index.d.ts.map