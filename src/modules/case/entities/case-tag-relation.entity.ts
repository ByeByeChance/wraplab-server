import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('case_tag_relation')
@Index(['tag_id'])
export class CaseTagRelation {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'case_id', type: 'bigint', unsigned: true })
  case_id: number;

  @Column({ name: 'tag_id', type: 'bigint', unsigned: true })
  tag_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
