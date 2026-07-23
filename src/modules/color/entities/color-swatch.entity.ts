import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ColorBrand } from './color-brand.entity';

@Entity('color_swatch')
export class ColorSwatch {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'brand_id', type: 'bigint', unsigned: true })
  brand_id: number;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'hex', type: 'varchar', length: 7 })
  hex: string;

  @Column({ name: 'rgb_r', type: 'tinyint', unsigned: true })
  rgb_r: number;

  @Column({ name: 'rgb_g', type: 'tinyint', unsigned: true })
  rgb_g: number;

  @Column({ name: 'rgb_b', type: 'tinyint', unsigned: true })
  rgb_b: number;

  @Column({ name: 'price_per_m2', type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  price_per_m2: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => ColorBrand, (brand) => brand.swatches)
  @JoinColumn({ name: 'brand_id' })
  colorBrand: ColorBrand;
}
