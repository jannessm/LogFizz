import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('time_logs')
export class TimeLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('uuid')
  button_id!: string;

  @Column('varchar')
  type!: 'start' | 'stop';

  @Column('timestamp')
  timestamp!: Date;

  @Column('boolean', { default: false })
  apply_break_calculation!: boolean;

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
