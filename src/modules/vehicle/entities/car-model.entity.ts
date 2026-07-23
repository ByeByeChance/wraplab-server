import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CarSeries } from './car-series.entity';

@Entity('car_model')
export class CarModel {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'series_id', type: 'bigint', unsigned: true })
  series_id: number;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Column({ name: 'body_type', type: 'varchar', length: 50, nullable: true })
  body_type: string | null;

  @Column({ name: 'model_3d_url', type: 'varchar', length: 500, nullable: true })
  model_3d_url: string | null;

  @Column({ name: 'usdz_url', type: 'varchar', length: 500, nullable: true })
  usdz_url: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => CarSeries, (series) => series.models)
  @JoinColumn({ name: 'series_id' })
  series: CarSeries;
}
