import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DailyTarget } from './DailyTarget.js';
import { State } from './State.js';

@Entity('user_state_entries')
export class UserStateEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  target_id!: string;

  @Column('uuid')
  state_id!: string;

  @Column('timestamptz')
  registered_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at?: Date;

  @ManyToOne(() => DailyTarget, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_id' })
  target?: DailyTarget;

  @ManyToOne(() => State, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'state_id' })
  state?: State;
}
