import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import type { UserEntity } from '../../../lib/types/index.js';

@Entity('users')
export class User implements UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { unique: true })
  email!: string;

  @Column('varchar')
  password_hash!: string;

  @Column('varchar')
  name!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at?: Date;

  @Column('varchar', { nullable: true })
  email_verification_token?: string;

  @Column('timestamptz', { nullable: true })
  email_verification_expires_at?: Date;

  @Column('timestamptz', { nullable: true })
  email_verified_at?: Date;

  @Column('varchar', { nullable: true })
  reset_token?: string;

  @Column('timestamptz', { nullable: true })
  reset_token_expires_at?: Date;

  @Column('varchar', { nullable: true, default: 'trial' })
  subscription_status?: 'trial' | 'active' | 'expired' | 'canceled';

  @Column('timestamptz', { nullable: true })
  subscription_end_date?: Date;

  @Column('timestamptz', { nullable: true })
  trial_end_date?: Date;

  @Column('varchar', { nullable: true })
  stripe_customer_id?: string;

  @Column('varchar', { nullable: true })
  stripe_subscription_id?: string;

  @OneToMany('Button', 'user')
  buttons?: any[];

  @OneToMany('TimeLog', 'user')
  time_logs?: any[];

  @OneToMany('MonthlyBalance', 'user')
  monthly_balances?: any[];
}
