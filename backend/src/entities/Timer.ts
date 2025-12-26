import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import type { TimerEntity } from '../../../lib/types/index.js';

@Entity('timers')
export class Timer implements TimerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('varchar')
  name!: string;

  @Column('varchar', { nullable: true })
  emoji?: string;

  @Column('varchar', { nullable: true })
  color?: string;

  @Column('uuid', { nullable: true })
  target_id?: string;

  @Column('boolean', { default: false })
  auto_subtract_breaks!: boolean;

  @Column('boolean', { default: false })
  archived!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at?: Date;

  @ManyToOne('User', 'timers', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @ManyToOne('Target', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_id' })
  target?: any;

  @OneToMany('TimeLog', 'timer')
  time_logs?: any[];
}
