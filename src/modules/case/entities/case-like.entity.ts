import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Case } from './case.entity';

@Entity('case_like')
@Unique(['case_id', 'staff_id'])
@Unique(['case_id', 'anonymous_id'])
export class CaseLike {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'case_id', type: 'bigint', unsigned: true })
  case_id: number;

  @Column({ name: 'staff_id', type: 'bigint', unsigned: true, nullable: true })
  staff_id: number | null;

  @Column({ name: 'anonymous_id', type: 'varchar', length: 64, nullable: true })
  anonymous_id: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => Case)
  @JoinColumn({ name: 'case_id' })
  case: Case;
}
