import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('scheduled_export_log')
@Index(['schedule_id'])
@Index(['executed_at'])
export class ScheduledExportLog {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'schedule_id', type: 'bigint', unsigned: true })
  schedule_id: number;

  @Column({ name: 'status', type: 'varchar', enum: ['success', 'failed'] })
  status: 'success' | 'failed';

  @Column({ name: 'file_url', type: 'varchar', length: 500, nullable: true })
  file_url: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  error_message: string | null;

  @Column({ name: 'executed_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  executed_at: Date;
}
