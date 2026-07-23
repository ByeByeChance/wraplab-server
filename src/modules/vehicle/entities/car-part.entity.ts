import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CarModel } from './car-model.entity';

@Entity('car_part')
export class CarPart {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'model_id', type: 'bigint', unsigned: true })
  model_id: number;

  @Column({ name: 'part_code', type: 'varchar', length: 20 })
  part_code: string;

  @Column({ name: 'area_m2', type: 'decimal', precision: 6, scale: 4, default: 0 })
  area_m2: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => CarModel)
  @JoinColumn({ name: 'model_id' })
  model: CarModel;
}
