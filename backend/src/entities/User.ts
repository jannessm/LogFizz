import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Button } from './Button';
import { TimeLog } from './TimeLog';

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

  @Column('varchar', { nullable: true })
  country?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => Button, button => button.user)
  buttons?: Button[];

  @OneToMany(() => TimeLog, timeLog => timeLog.user)
  time_logs?: TimeLog[];
}
