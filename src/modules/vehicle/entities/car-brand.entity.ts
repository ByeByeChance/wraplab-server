import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { CarSeries } from './car-series.entity';

@Entity('car_brand')
export class CarBrand {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'logo', type: 'varchar', length: 500, nullable: true })
  logo: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;

  @OneToMany(() => CarSeries, (series) => series.brand)
  series: CarSeries[];
}
