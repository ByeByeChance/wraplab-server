import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('case_tag')
@Index(['store_id'])
export class CaseTag {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 30 })
  name: string;

  @Column({ name: 'color', type: 'varchar', length: 7, default: '#1890FF' })
  color: string;

  @Column({ name: 'sort_order', type: 'int', unsigned: true, default: 0 })
  sort_order: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true, nullable: true })
  store_id: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;
}
