import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import type { StateEntity } from '../../../lib/types/index.js';

@Entity('states')
export class State implements StateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar')
  country!: string;

  @Column('varchar')
  state!: string;

  @Column('varchar', { unique: true })
  code!: string; // e.g., 'DE-BW' for Baden-Württemberg
}
