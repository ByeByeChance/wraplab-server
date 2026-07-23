import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

export type CampaignType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'GIFT';
export type CampaignStatus = 'active' | 'inactive' | 'draft' | 'pending_approval' | 'approved';
export type CampaignApprovalStatus = 'pending' | 'approved' | 'rejected';

@Entity('campaign')
export class Campaign {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'type', type: 'varchar', enum: ['PERCENTAGE', 'FIXED_AMOUNT', 'GIFT'] })
  type: CampaignType;

  @Column({
    name: 'discount_value',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  discount_value: number;

  @Column({
    name: 'min_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  min_amount: number | null;

  @Column({ name: 'gift_name', type: 'varchar', length: 200, nullable: true })
  gift_name: string | null;

  @Column({ name: 'target_store_ids', type: 'json', nullable: true })
  target_store_ids: number[] | null;

  @Column({ name: 'new_customer_only', type: 'tinyint', width: 1, default: 0 })
  new_customer_only: boolean;

  @Column({ name: 'start_time', type: 'datetime' })
  start_time: Date;

  @Column({ name: 'end_time', type: 'datetime' })
  end_time: Date;

  @Column({
    name: 'status',
    type: 'varchar',
    enum: ['active', 'inactive', 'draft', 'pending_approval', 'approved'],
    default: 'draft',
  })
  status: CampaignStatus;

  @Column({ name: 'auto_publish', type: 'tinyint', width: 1, default: 0 })
  auto_publish: boolean;

  @Column({ name: 'auto_expire', type: 'tinyint', width: 1, default: 0 })
  auto_expire: boolean;

  @Column({
    name: 'approval_status',
    type: 'varchar',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  approval_status: CampaignApprovalStatus;

  @Column({ name: 'approved_by', type: 'bigint', unsigned: true, nullable: true })
  approved_by: number | null;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approved_at: Date | null;

  @Column({ name: 'reject_reason', type: 'varchar', length: 500, nullable: true })
  reject_reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deleted_at: Date | null;
}
