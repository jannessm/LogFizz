import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { unique: true })
  email!: string;

  @Column('varchar')
  name!: string;

  @Column('varchar', { nullable: true })
  state?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at?: Date;

  @Column('varchar', { nullable: true })
  login_code?: string;

  @Column('timestamptz', { nullable: true })
  login_code_expires_at?: Date;

  @OneToMany('Button', 'user')
  buttons?: any[];

  @OneToMany('TimeLog', 'user')
  time_logs?: any[];
}
