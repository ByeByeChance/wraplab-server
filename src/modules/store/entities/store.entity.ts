import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('store')
export class Store {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'address', type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ name: 'location', type: 'json', nullable: true })
  location: { lat: number; lng: number } | null;

  @Column({ name: 'business_hours', type: 'json', nullable: true })
  business_hours: { open: string; close: string; off_days: string[] } | null;

  @Column({ name: 'services_offered', type: 'json', nullable: true })
  services_offered: string[] | null;

  @Column({ name: 'capacity_config', type: 'json', nullable: true })
  capacity_config: { max_daily_appointments: number; slot_duration_minutes: number } | null;

  @Column({ name: 'region', type: 'varchar', length: 100, nullable: true })
  region: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'logo', type: 'varchar', length: 500, nullable: true })
  logo: string | null;

  @Column({ name: 'status', type: 'varchar', enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;
}
