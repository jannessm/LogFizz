import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('time_logs')
export class TimeLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('uuid')
  button_id!: string;

  @Column('timestamp')
  start_time!: Date;

  @Column('timestamp', { nullable: true })
  end_time?: Date;

  @Column('int', { nullable: true })
  duration?: number;

  @Column('int', { default: 0 })
  break_time_subtracted!: number;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('boolean', { default: false })
  is_manual!: boolean;

  @ManyToOne('User', 'time_logs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @ManyToOne('Button', 'time_logs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'button_id' })
  button!: any;
}
