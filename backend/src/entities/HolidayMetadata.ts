import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('holiday_metadata')
export class HolidayMetadata {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar')
  country!: string;

  @Column('int')
  year!: number;

  @Column('timestamp')
  last_fetched_at!: Date;

  @Column('int', { default: 0 })
  holiday_count!: number;

  @Column('varchar', { nullable: true })
  source_url?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
