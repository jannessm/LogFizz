import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import type { HolidayEntity } from '../../../lib/types/index.js';

@Entity('holidays')
export class Holiday implements HolidayEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar')
  country!: string;

  @Column('date')
  date!: Date;

  @Column('varchar')
  name!: string;

  @Column('int')
  year!: number;
}
