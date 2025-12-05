import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import type { TimeLogEntity } from '../../../lib/types/index.js';

@Entity('time_logs')
export class TimeLog implements TimeLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('uuid')
  button_id!: string;

  @Column('timestamptz')
  start_timestamp!: Date;

  @Column('timestamptz', { nullable: true })
  end_timestamp?: Date;

  @Column('int', { nullable: true })
  duration_minutes?: number;

  @Column('varchar')
  timezone!: string;

  @Column('boolean', { default: false })
  apply_break_calculation!: boolean;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('boolean', { default: false })
  is_manual!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at?: Date;

  @ManyToOne('User', 'time_logs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @ManyToOne('Button', 'time_logs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'button_id' })
  button!: any;

  // /**
  //  * Automatically calculate duration_minutes when end_timestamp is set
  //  */
  // @BeforeInsert()
  // @BeforeUpdate()
  // calculateDuration() {
  //   if (this.end_timestamp && this.start_timestamp) {
  //     const start = new Date(this.start_timestamp).getTime();
  //     const end = new Date(this.end_timestamp).getTime();
  //     this.duration_minutes = Math.round((end - start) / (1000 * 60));
  //   }
  // }
}
