import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import type { TimeLogEntity, TimeLogType } from '../../../lib/types/index.js';

@Entity('time_logs')
export class TimeLog implements TimeLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('uuid')
  button_id!: string;

  @Column('varchar', { default: 'normal' })
  type!: TimeLogType;

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

  @Column('boolean', { default: false })
  is_manual!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at?: Date;

  @ManyToOne('User', 'time_logs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @ManyToOne('Button', 'time_logs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'button_id' })
  button!: any;


}
