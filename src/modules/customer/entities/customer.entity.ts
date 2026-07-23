import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type CustomerSource = 'appointment' | 'quote' | 'import';

@Entity('customer')
export class Customer {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'phone', type: 'varchar', length: 20 })
  phone: string;

  @Column({
    name: 'source',
    type: 'varchar',
    enum: ['appointment', 'quote', 'import'],
    default: 'appointment',
  })
  source: CustomerSource;

  @Column({ name: 'total_orders', type: 'int', default: 0 })
  total_orders: number;

  @Column({ name: 'birthday', type: 'date', nullable: true })
  birthday: string | null;

  @Column({ name: 'anniversary_date', type: 'date', nullable: true })
  anniversary_date: string | null;

  @Column({ name: 'anniversary_label', type: 'varchar', length: 50, nullable: true })
  anniversary_label: string | null;

  @Column({ name: 'wechat_openid', type: 'varchar', length: 100, nullable: true })
  wechat_openid: string | null;

  @Column({ name: 'assigned_staff_id', type: 'bigint', unsigned: true, nullable: true })
  assigned_staff_id: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
