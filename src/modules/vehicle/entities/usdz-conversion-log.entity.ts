import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('usdz_conversion_log')
@Index(['model_id'])
@Index(['status'])
export class UsdzConversionLog {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'model_id', type: 'bigint', unsigned: true })
  model_id: number;

  @Column({ name: 'status', type: 'varchar', enum: ['processing', 'completed', 'failed'] })
  status: 'processing' | 'completed' | 'failed';

  @Column({ name: 'error_message', type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
