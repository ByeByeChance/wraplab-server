import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { CarBrand } from './car-brand.entity';
import { CarModel } from './car-model.entity';

@Entity('car_series')
export class CarSeries {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'brand_id', type: 'bigint', unsigned: true })
  brand_id: number;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'year_start', type: 'int', nullable: true })
  year_start: number | null;

  @Column({ name: 'year_end', type: 'int', nullable: true })
  year_end: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => CarBrand, (brand) => brand.series)
  @JoinColumn({ name: 'brand_id' })
  brand: CarBrand;

  @OneToMany(() => CarModel, (model) => model.series)
  models: CarModel[];
}
