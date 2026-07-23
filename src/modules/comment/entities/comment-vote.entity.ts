import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('comment_vote')
@Index(['comment_id'])
export class CommentVote {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'comment_id', type: 'bigint', unsigned: true })
  comment_id: number;

  @Column({ name: 'staff_id', type: 'bigint', unsigned: true })
  staff_id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
