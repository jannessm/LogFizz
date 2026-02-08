import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './User.js';
import type { StatisticsEmailFrequency } from '../../../lib/types/index.js';

@Entity('user_settings')
@Unique(['user_id'])
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column('varchar', { default: 'en' })
  language!: string; // 'en' | 'de'

  @Column('varchar', { default: 'en-US' })
  locale!: string; // Locale for date/time formatting e.g., 'en-US', 'de-DE'

  @Column('varchar', { default: 'none' })
  statistics_email_frequency!: StatisticsEmailFrequency; // 'none' | 'weekly' | 'monthly'

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
