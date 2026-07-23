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

@Entity('ai_generation')
export class AiGeneration {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'configuration_id', type: 'bigint', unsigned: true })
  configuration_id: number;

  @Column({ name: 'prompt_text', type: 'text' })
  prompt_text: string;

  @Column({ name: 'style', type: 'varchar', enum: ['scene', 'studio', 'outdoor'] })
  style: 'scene' | 'studio' | 'outdoor';

  @Column({
    name: 'status',
    type: 'varchar',
    enum: ['pending', 'queued', 'processing', 'completed', 'failed'],
    default: 'pending',
  })
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';

  @Column({ name: 'job_id', type: 'varchar', length: 36, nullable: true })
  job_id: string | null;

  @Column({ name: 'queue_position', type: 'int', unsigned: true, nullable: true })
  queue_position: number | null;

  @Column({ name: 'retry_count', type: 'tinyint', unsigned: true, default: 0 })
  retry_count: number;

  @Column({ name: 'result_image_url', type: 'varchar', length: 500, nullable: true })
  result_image_url: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  error_message: string | null;

  @Column({ name: 'staff_id', type: 'bigint', unsigned: true })
  staff_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Configuration)
  @JoinColumn({ name: 'configuration_id' })
  configuration: Configuration;
}
