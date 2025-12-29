import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import type { HolidayMetadataEntity } from '../../../lib/types/index.js';

@Entity('holiday_metadata')
export class HolidayMetadata implements Omit<HolidayMetadataEntity, 'last_updated'> {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar')
  country!: string;

  @Column('varchar')
  state!: string;

  @Column('int')
  year!: number;

  @Column('timestamp')
  last_updated!: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
