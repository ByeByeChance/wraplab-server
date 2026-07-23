import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('store_service_config')
@Index(['store_id'])
export class StoreServiceConfig {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({
    name: 'service_type',
    type: 'varchar',
    enum: ['full_wrap', 'partial_wrap', 'detail_treatment', 'color_change', 'other'],
  })
  service_type: string;

  @Column({ name: 'duration_minutes', type: 'int', unsigned: true })
  duration_minutes: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;
}
