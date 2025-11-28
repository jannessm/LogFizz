import { Entity, PrimaryColumn, Column } from 'typeorm';
import type { StateEntity } from '../../../lib/types/index.js';

@Entity('states')
export class State implements StateEntity {
  @PrimaryColumn('varchar')
  code!: string; // e.g., 'DE-BW' for Baden-Württemberg

  @Column('varchar')
  country!: string;

  @Column('varchar')
  state!: string;
}
