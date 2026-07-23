import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { StaffStore } from './staff-store.entity';

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'current_store_id', type: 'bigint', unsigned: true })
  current_store_id: number;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'phone', type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  password_hash: string;

  @Column({ name: 'role', type: 'varchar', enum: ['admin', 'manager', 'staff'], default: 'staff' })
  role: 'admin' | 'manager' | 'staff';

  @Column({ name: 'avatar', type: 'varchar', length: 500, nullable: true })
  avatar: string | null;

  @Column({ name: 'status', type: 'varchar', enum: ['active', 'disabled'], default: 'active' })
  status: 'active' | 'disabled';

  @Column({ name: 'token_version', type: 'int', unsigned: true, default: 0 })
  token_version: number;

  @Column({ name: 'wechat_openid', type: 'varchar', length: 100, nullable: true })
  wechat_openid: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;

  @OneToMany(() => StaffStore, (staffStore) => staffStore.staff_id)
  staffStores: StaffStore[];
}
