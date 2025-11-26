import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

@Entity('daily_targets')
export class DailyTarget {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('varchar')
  name!: string;

  @Column('simple-array')
  duration_minutes!: number[];

  @Column('simple-array')
  weekdays!: number[]; // 0-6 for Sunday-Saturday

  @Column('boolean', { default: false })
  exclude_holidays!: boolean; // Whether to exclude public holidays from target calculation

  @Column('uuid', { nullable: true })
  state_id?: string;

  @Column('timestamptz', { nullable: true })
  starting_from?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at?: Date;

  @ManyToOne('User', 'daily_targets', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @ManyToOne('State', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'state_id' })
  state?: any;

  @OneToMany('MonthlyBalance', 'target')
  monthly_balances?: any[];
}
