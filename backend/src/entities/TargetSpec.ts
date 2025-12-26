import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { TargetSpecEntity } from '../../../lib/types/index.js';

@Entity('target_specs')
export class TargetSpec implements TargetSpecEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('uuid')
  target_id!: string;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP' })
  starting_from!: Date;


  @Column('timestamptz', { nullable: true })
  ending_at?: Date;


  @Column('simple-array')
  duration_minutes!: number[];

  @Column('simple-array')
  weekdays!: number[]; // 0-6 for Sunday-Saturday

  @Column('boolean', { default: false })
  exclude_holidays!: boolean; // Whether to exclude public holidays from target calculation

  @Column('varchar', { nullable: true })
  state_code?: string;


  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne('User', 'target_specs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @ManyToOne('Target', 'target_specs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_id' })
  target!: any;

  @ManyToOne('State', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'state_code', referencedColumnName: 'code' })
  state?: any;
}
