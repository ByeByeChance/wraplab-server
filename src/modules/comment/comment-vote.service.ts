import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CommentVote } from './entities/comment-vote.entity';
import { Comment } from './entities/comment.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';

function isDbError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}

@Injectable()
export class CommentVoteService {
  private readonly logger = new Logger(CommentVoteService.name);

  constructor(
    @InjectRepository(CommentVote)
    private readonly voteRepo: Repository<CommentVote>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
  ) {}

  async toggle(
    commentId: number,
    staffId: number,
    storeId: number,
  ): Promise<{ vote_count: number; is_voted: boolean }> {
    // Validate comment exists
    const comment = await this.commentRepo.findOne({
      where: { id: commentId, deleted_at: IsNull() },
    });
    if (!comment) {
      throw new BusinessException(ErrorCode.COMMENT_NOT_FOUND, '评论不存在');
    }

    // Check existing vote
    const existing = await this.voteRepo.findOne({
      where: { comment_id: commentId, staff_id: staffId },
    });

    if (existing) {
      // Cancel vote — use atomic decrement
      await this.voteRepo.delete(existing.id);
      await this.commentRepo.decrement({ id: commentId }, 'vote_count', 1);
      // Re-read to get accurate count
      const updated = await this.commentRepo.findOne({
        where: { id: commentId },
        select: ['vote_count'],
      });
      return { vote_count: updated?.vote_count ?? 0, is_voted: false };
    } else {
      // Add vote — use atomic increment
      const vote = this.voteRepo.create({
        comment_id: commentId,
        staff_id: staffId,
        store_id: storeId,
      });
      try {
        await this.voteRepo.save(vote);
      } catch (err: unknown) {
        // Unique constraint violation - already voted (concurrent)
        if (isDbError(err) && err.code === 'ER_DUP_ENTRY') {
          throw new BusinessException(ErrorCode.VOTE_ALREADY_CAST, '您已对该评论点赞');
        }
        throw err;
      }
      await this.commentRepo.increment({ id: commentId }, 'vote_count', 1);
      // Re-read to get accurate count
      const updated = await this.commentRepo.findOne({
        where: { id: commentId },
        select: ['vote_count'],
      });
      return { vote_count: updated?.vote_count ?? 1, is_voted: true };
    }
  }
}
