import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import type { ButtonEntity } from '../../../lib/types/index.js';

@Entity('buttons')
export class Button implements ButtonEntity {
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

  @ManyToOne('User', 'buttons', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @ManyToOne('DailyTarget', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_id' })
  daily_target?: any;

  @OneToMany('TimeLog', 'button')
  time_logs?: any[];
}
