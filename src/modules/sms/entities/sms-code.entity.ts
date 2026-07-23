import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sms_code')
export class SmsCode {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'phone', type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'code', type: 'varchar', length: 6 })
  code: string;

  @Column({ name: 'type', type: 'varchar', enum: ['login', 'verify', 'appointment'] })
  type: 'login' | 'verify' | 'appointment';

  @Column({ name: 'expires_at', type: 'datetime' })
  expires_at: Date;

  @Column({ name: 'used', type: 'tinyint', width: 1, default: 0 })
  used: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
