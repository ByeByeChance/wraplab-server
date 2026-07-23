import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('campaign_claim')
export class CampaignClaim {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'campaign_id', type: 'bigint', unsigned: true })
  campaign_id: number;

  @Column({ name: 'quote_id', type: 'bigint', unsigned: true })
  quote_id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  discount_amount: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
