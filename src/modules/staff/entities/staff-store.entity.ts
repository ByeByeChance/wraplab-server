import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('staff_store')
@Index(['store_id'])
export class StaffStore {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'staff_id', type: 'bigint', unsigned: true })
  staff_id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'role_in_store', type: 'varchar', enum: ['staff', 'manager'], default: 'staff' })
  role_in_store: 'staff' | 'manager';

  @Column({ name: 'assigned_at', type: 'datetime' })
  assigned_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;
}
