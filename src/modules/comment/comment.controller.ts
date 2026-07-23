import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentDto } from './dto/list-comment.dto';
import { ApproveCommentDto } from './dto/approve-comment.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Public()
  @Get('cases/:caseId/comments')
  async findByCaseId(@Param('caseId', ParseIntPipe) caseId: number, @Query() query: ListCommentDto) {
    return this.commentService.findByCaseId(caseId, query);
  }

  @Post('cases/:caseId/comments')
  @HttpCode(HttpStatus.CREATED)
  async create(@Param('caseId', ParseIntPipe) caseId: number, @Body() dto: CreateCommentDto) {
    return this.commentService.create(caseId, dto);
  }

  @Delete('cases/:caseId/comments/:commentId')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('caseId', ParseIntPipe) caseId: number, @Param('commentId', ParseIntPipe) commentId: number) {
    await this.commentService.delete(caseId, commentId);
    return null;
  }

  @Roles('admin', 'manager')
  @Get('admin/comments/pending')
  async getPendingComments(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('size', ParseIntPipe) size: number = 20,
  ) {
    return this.commentService.getPendingComments(page, size);
  }

  @Roles('admin', 'manager')
  @Put('admin/comments/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveCommentDto) {
    return this.commentService.approve(id, dto);
  }
}
