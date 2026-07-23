import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Case } from '../../case/entities/case.entity';
import { Staff } from '../../staff/entities/staff.entity';

@Entity('case_comment')
export class Comment {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'case_id', type: 'bigint', unsigned: true })
  case_id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'staff_id', type: 'bigint', unsigned: true })
  staff_id: number;

  @Column({ name: 'parent_id', type: 'bigint', unsigned: true, nullable: true })
  parent_id: number | null;

  @Column({ name: 'content', type: 'varchar', length: 500 })
  content: string;

  @Column({
    name: 'status',
    type: 'varchar',
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved',
  })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ name: 'vote_count', type: 'int', unsigned: true, default: 0 })
  vote_count: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Case)
  @JoinColumn({ name: 'case_id' })
  case: Case;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'staff_id' })
  staff: Staff;

  @ManyToOne(() => Comment, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Comment | null;
}
