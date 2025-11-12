import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('holidays')
export class Holiday {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar')
  country!: string;

  @Column('varchar', { nullable: true })
  state?: string;

  @Column('date')
  date!: Date;

  @Column('varchar')
  name!: string;

  @Column('int')
  year!: number;
}
