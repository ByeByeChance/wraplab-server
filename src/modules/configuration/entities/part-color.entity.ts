import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Configuration } from './configuration.entity';
import { ColorSwatch } from '../../color/entities/color-swatch.entity';
import { Material } from '../../color/entities/material.entity';

@Entity('part_color')
export class PartColor {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'configuration_id', type: 'bigint', unsigned: true })
  configuration_id: number;

  @Column({ name: 'part_code', type: 'varchar', length: 20 })
  part_code: string;

  @Column({ name: 'color_swatch_id', type: 'bigint', unsigned: true })
  color_swatch_id: number;

  @Column({ name: 'material_id', type: 'bigint', unsigned: true })
  material_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Configuration, (config) => config.partColors)
  @JoinColumn({ name: 'configuration_id' })
  configuration: Configuration;

  @ManyToOne(() => ColorSwatch)
  @JoinColumn({ name: 'color_swatch_id' })
  colorSwatch: ColorSwatch;

  @ManyToOne(() => Material)
  @JoinColumn({ name: 'material_id' })
  material: Material;
}
