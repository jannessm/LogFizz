import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { BalanceEntity } from '../../../lib/types/index.js';

@Entity('balances')
@Index(['user_id', 'target_id', 'date'], { unique: true })
export class Balance implements BalanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('uuid')
  target_id!: string;

  @Column('uuid', { default: null })
  next_balance_id: string;


  @Column('varchar') // year, year-month, or year-month-date
  date!: string;

  @Column('integer', { default: 0 })
  due_minutes!: number; // Total minutes required by target
  
  @Column('integer', { default: 0 })
  worked_minutes!: number; // Total minutes worked

  @Column('integer', { default: 0 })
  cumulative_minutes!: number; // cumulative balance from previous balance

  
  @Column('integer', { default: 0 })
  sick_days!: number;
  
  @Column('integer', { default: 0 })
  holidays!: number;
  
  @Column('integer', { default: 0 })
  business_trip!: number;
  
  @Column('integer', { default: 0 })
  child_sick!: number;

  @Column('integer', { default: 0 })
  worked_days!: number; // Whether holidays were excluded from calculation


  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  deleted_at?: Date;


  @ManyToOne('User', 'balances', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @ManyToOne('Target', 'balances', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_id' })
  target!: any;
}
