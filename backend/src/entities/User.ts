import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

@Entity('users')
export class User {
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

  @OneToMany('Button', 'user')
  buttons?: any[];

  @OneToMany('TimeLog', 'user')
  time_logs?: any[];

  @OneToMany('MonthlyBalance', 'user')
  monthly_balances?: any[];
}
