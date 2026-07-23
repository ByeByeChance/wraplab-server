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

@Entity('case')
export class Case {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'configuration_id', type: 'bigint', unsigned: true })
  configuration_id: number;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'cover_image_url', type: 'varchar', length: 500, nullable: true })
  cover_image_url: string | null;

  @Column({ name: 'images', type: 'json', nullable: true })
  images: string[] | null;

  @Column({ name: 'status', type: 'varchar', enum: ['draft', 'published'], default: 'published' })
  status: 'draft' | 'published';

  @Column({ name: 'view_count', type: 'int', unsigned: true, default: 0 })
  view_count: number;

  @Column({ name: 'like_count', type: 'int', unsigned: true, default: 0 })
  like_count: number;

  @Column({ name: 'share_count', type: 'int', unsigned: true, default: 0 })
  share_count: number;

  @Column({ name: 'comment_count', type: 'int', unsigned: true, default: 0 })
  comment_count: number;

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
}
