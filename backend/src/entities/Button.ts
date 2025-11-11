import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';

@Entity('buttons')
export class Button {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('varchar')
  name!: string;

  @Column('varchar', { nullable: true })
  emoji?: string;

  @Column('varchar', { nullable: true })
  color?: string;

  @Column('int', { default: 0 })
  position!: number;

  @Column('varchar', { nullable: true })
  icon?: string;

  @Column('int', { nullable: true })
  goal_time_minutes?: number;

  @Column('simple-array', { nullable: true })
  goal_days?: number[];

  @Column('boolean', { default: false })
  auto_subtract_breaks!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne('User', 'buttons', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @OneToMany('TimeLog', 'button')
  time_logs?: any[];
}
