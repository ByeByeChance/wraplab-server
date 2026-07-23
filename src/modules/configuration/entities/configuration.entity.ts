import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PartColor } from './part-color.entity';
import { CarModel } from '../../vehicle/entities/car-model.entity';

@Entity('configuration')
export class Configuration {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'model_id', type: 'bigint', unsigned: true })
  model_id: number;

  @Column({ name: 'name', type: 'varchar', length: 200, nullable: true })
  name: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 100, nullable: true })
  customer_name: string | null;

  @Column({ name: 'customer_phone', type: 'varchar', length: 20, nullable: true })
  customer_phone: string | null;

  @Column({ name: 'status', type: 'varchar', enum: ['draft', 'confirmed', 'quoted'], default: 'draft' })
  status: 'draft' | 'confirmed' | 'quoted';

  @Column({ name: 'staff_id', type: 'bigint', unsigned: true })
  staff_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => CarModel)
  @JoinColumn({ name: 'model_id' })
  model: CarModel;

  @OneToMany(() => PartColor, (partColor) => partColor.configuration)
  partColors: PartColor[];
}
