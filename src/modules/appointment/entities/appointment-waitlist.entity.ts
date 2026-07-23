import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('appointment_waitlist')
@Index(['time_slot_id', 'appointment_date', 'status'])
@Index(['customer_phone', 'appointment_date'])
@Index(['store_id', 'appointment_date'])
export class AppointmentWaitlist {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'appointment_date', type: 'date' })
  appointment_date: string;

  @Column({ name: 'time_slot_id', type: 'bigint', unsigned: true })
  time_slot_id: number;

  @Column({ name: 'customer_name', type: 'varchar', length: 50 })
  customer_name: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 20 })
  customer_phone: string;

  @Column({ name: 'vehicle_info', type: 'varchar', length: 200, nullable: true })
  vehicle_info: string | null;

  @Column({
    name: 'service_type',
    type: 'varchar',
    enum: ['full_wrap', 'partial_wrap', 'detail_treatment', 'color_change', 'other'],
  })
  service_type: string;

  @Column({ name: 'position', type: 'int', unsigned: true })
  position: number;

  @Column({
    name: 'status',
    type: 'varchar',
    enum: ['waiting', 'promoted', 'cancelled', 'expired'],
    default: 'waiting',
  })
  status: 'waiting' | 'promoted' | 'cancelled' | 'expired';

  @Column({ name: 'promoted_appointment_id', type: 'bigint', unsigned: true, nullable: true })
  promoted_appointment_id: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;
}
