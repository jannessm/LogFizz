import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('states')
export class State {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar')
  country!: string;

  @Column('varchar')
  state!: string;

  @Column('varchar', { unique: true })
  code!: string; // e.g., 'DE-BW' for Baden-Württemberg
}
