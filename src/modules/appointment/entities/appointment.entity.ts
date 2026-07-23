import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type TimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING';
export type ServiceType = 'CONSULTATION' | 'INSTALLATION' | 'MAINTENANCE' | 'OTHER';

export const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function validateTransition(current: AppointmentStatus, next: AppointmentStatus): boolean {
  const allowed = VALID_TRANSITIONS[current];
  return allowed !== undefined && allowed.includes(next);
}

@Entity('appointment')
export class Appointment {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'customer_id', type: 'bigint', unsigned: true, nullable: true })
  customer_id: number | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 100 })
  customer_name: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 20 })
  customer_phone: string;

  @Column({ name: 'service_type', type: 'varchar', length: 50 })
  service_type: string;

  @Column({ name: 'appointment_date', type: 'date' })
  appointment_date: string;

  @Column({ name: 'time_slot', type: 'varchar', enum: ['MORNING', 'AFTERNOON', 'EVENING'] })
  time_slot: TimeSlot;

  @Column({
    name: 'status',
    type: 'varchar',
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
  })
  status: AppointmentStatus;

  @Column({ name: 'vehicle_info', type: 'json', nullable: true })
  vehicle_info: Record<string, unknown> | null;

  @Column({ name: 'remark', type: 'varchar', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'cancel_reason', type: 'varchar', length: 500, nullable: true })
  cancel_reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
