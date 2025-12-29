import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import type { TargetEntity } from '../../../lib/types/index.js';
import { TargetSpec } from './TargetSpec.js';

@Entity('targets')
export class Target implements TargetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('varchar')
  name!: string;

  @Column('simple-array')
  target_spec_ids: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at?: Date;

  @ManyToOne('User', 'targets', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @OneToMany('Balance', 'target')
  balances?: any[];

  @OneToMany('TargetSpec', 'target')
  target_specs!: TargetSpec[];
}
