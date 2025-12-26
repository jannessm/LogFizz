import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { TimeLogEntity, TimeLogType } from '../../../lib/types/index.js';

@Entity('time_logs')
export class TimeLog implements TimeLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('uuid')
  timer_id!: string;

  @Column('varchar', { default: 'normal' })
  type!: TimeLogType;

  @Column('boolean', { default: false })
  whole_day!: boolean;

  @Column('timestamptz')
  start_timestamp!: Date;

  @Column('timestamptz', { nullable: true })
  end_timestamp?: Date;

  @Column('int', { nullable: true })
  duration_minutes?: number;

  @Column('varchar')
  timezone!: string;

  @Column('boolean', { default: false })
  apply_break_calculation!: boolean;

  @Column('text', { nullable: true })
  notes?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at?: Date;

  @ManyToOne('User', 'time_logs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @ManyToOne('Timer', 'time_logs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'timer_id' })
  timer!: any;
}
