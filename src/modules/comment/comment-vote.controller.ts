import { Controller, Post, Param, ParseIntPipe } from '@nestjs/common';
import { CommentVoteService } from './comment-vote.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { StoreContext } from '../../common/context/store-context';

@Controller()
export class CommentVoteController {
  constructor(private readonly commentVoteService: CommentVoteService) {}

  @Post('cases/comments/:id/vote')
  async toggle(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    const storeId = StoreContext.getStoreId() ?? user.store_id ?? 0;
    return this.commentVoteService.toggle(id, user.sub, storeId);
  }
}
