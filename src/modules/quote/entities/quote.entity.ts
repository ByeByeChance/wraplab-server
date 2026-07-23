import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Configuration } from '../../configuration/entities/configuration.entity';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCode } from '../../../common/exceptions/error-codes';

export type QuoteStatus = 'pending' | 'confirmed' | 'cancelled' | 'submitted' | 'followed_up' | 'closed' | 'expired';

export const VALID_QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  pending: ['confirmed', 'cancelled', 'expired', 'closed'],
  confirmed: ['submitted', 'cancelled', 'expired'],
  cancelled: [],
  submitted: ['followed_up', 'closed'],
  followed_up: ['closed', 'submitted'],
  closed: [],
  expired: [],
};

@Entity('quote')
export class Quote {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'configuration_id', type: 'bigint', unsigned: true })
  configuration_id: number;

  @Column({
    name: 'total_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  total_price: number;

  @Column({
    name: 'campaign_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  campaign_id: number | null;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  discount_amount: number;

  @Column({
    name: 'final_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  final_price: number | null;

  @Column({
    name: 'status',
    type: 'varchar',
    enum: ['pending', 'confirmed', 'cancelled', 'submitted', 'followed_up', 'closed', 'expired'],
    default: 'pending',
  })
  status: QuoteStatus;

  @Column({ name: 'staff_id', type: 'bigint', unsigned: true })
  staff_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Configuration)
  @JoinColumn({ name: 'configuration_id' })
  configuration: Configuration;

  /**
   * Validate and update the quote status using state machine rules.
   * Throws if the transition is invalid.
   */
  updateStatus(newStatus: QuoteStatus): void {
    const allowed = VALID_QUOTE_TRANSITIONS[this.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BusinessException(
        ErrorCode.VALIDATION_FAILED,
        `Invalid status transition: ${this.status} -> ${newStatus}`,
      );
    }
    this.status = newStatus;
  }
}
