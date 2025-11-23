import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';

@Entity('monthly_balances')
@Index(['user_id', 'target_id', 'year', 'month'], { unique: true })
export class MonthlyBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('uuid')
  target_id!: string;

  @Column('integer')
  year!: number;

  @Column('integer')
  month!: number; // 1-12

  @Column('integer')
  worked_minutes!: number; // Total minutes worked

  @Column('integer')
  due_minutes!: number; // Total minutes required by target

  @Column('integer')
  balance_minutes!: number; // worked_minutes - due_minutes

  @Column('boolean', { default: false })
  exclude_holidays!: boolean; // Whether holidays were excluded from calculation

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne('User', 'monthly_balances', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @ManyToOne('DailyTarget', 'monthly_balances', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_id' })
  target!: any;
}
