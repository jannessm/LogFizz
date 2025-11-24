import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

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

  @Column('varchar', { nullable: true })
  country?: string;

  @Column('varchar', { nullable: true })
  state?: string;

  @Column('timestamptz', { nullable: true })
  registered_at?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at?: Date;

  @ManyToOne('User', 'daily_targets', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;
}
