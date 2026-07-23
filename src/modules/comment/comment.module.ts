import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentController } from './comment.controller';
import { CommentVoteController } from './comment-vote.controller';
import { CommentService } from './comment.service';
import { CommentVoteService } from './comment-vote.service';
import { SensitiveWordService } from './sensitive-word.service';
import { Comment } from './entities/comment.entity';
import { CommentVote } from './entities/comment-vote.entity';
import { Case } from '../case/entities/case.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, CommentVote, Case])],
  controllers: [CommentController, CommentVoteController],
  providers: [CommentService, CommentVoteService, SensitiveWordService],
  exports: [CommentService, CommentVoteService],
})
export class CommentModule {}
