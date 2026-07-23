import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('scheduled_export')
@Index(['enabled', 'next_execution_at'])
export class ScheduledExport {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'export_type', type: 'varchar', enum: ['pdf', 'excel', 'csv'] })
  export_type: string;

  @Column({ name: 'sections', type: 'json' })
  sections: string[];

  @Column({ name: 'cron_expression', type: 'varchar', length: 50 })
  cron_expression: string;

  @Column({ name: 'recipients', type: 'json' })
  recipients: { email: string; phone?: string }[];

  @Column({ name: 'enabled', type: 'tinyint', default: 1 })
  enabled: boolean;

  @Column({ name: 'last_executed_at', type: 'datetime', nullable: true })
  last_executed_at: Date | null;

  @Column({ name: 'next_execution_at', type: 'datetime', nullable: true })
  next_execution_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;
}
