import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('webhook_config')
export class WebhookConfig {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'type', type: 'varchar', enum: ['wecom', 'dingtalk'] })
  type: 'wecom' | 'dingtalk';

  @Column({ name: 'url', type: 'varchar', length: 500 })
  url: string;

  @Column({ name: 'events', type: 'json' })
  events: string[];

  @Column({ name: 'status', type: 'tinyint', width: 1, default: 1 })
  status: number;

  @Column({ name: 'secret', type: 'varchar', length: 128, nullable: true })
  secret: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;
}
