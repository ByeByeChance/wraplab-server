import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Store } from '../../store/entities/store.entity';

@Entity('store_location')
export class StoreLocation {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'lat', type: 'decimal', precision: 10, scale: 7 })
  lat: number;

  @Column({ name: 'lng', type: 'decimal', precision: 10, scale: 7 })
  lng: number;

  @Column({ name: 'address', type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ name: 'province', type: 'varchar', length: 100, nullable: true })
  province: string | null;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ name: 'district', type: 'varchar', length: 100, nullable: true })
  district: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToOne(() => Store)
  @JoinColumn({ name: 'store_id' })
  store: Store;
}
