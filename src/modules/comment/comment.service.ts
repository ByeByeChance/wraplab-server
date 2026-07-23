import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan, In, FindOptionsWhere } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Case } from '../case/entities/case.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { SensitiveWordService } from './sensitive-word.service';
import { sanitizeText } from '../../common/utils/sanitize';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentDto } from './dto/list-comment.dto';
import { ApproveCommentDto } from './dto/approve-comment.dto';

export interface CommentWithReplies {
  id: number;
  content: string;
  staff_name: string;
  staff_avatar: string | null;
  is_author: boolean;
  created_at: Date;
  replies: CommentWithReplies[];
}

@Injectable()
export class CommentService implements OnModuleInit {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Case)
    private readonly caseRepo: Repository<Case>,
    private readonly sensitiveWordService: SensitiveWordService,
  ) {}

  onModuleInit(): void {
    // Initialize DFA sensitive word filter with basic list.
    // In production, load from config/database.
    // NOTE: Currently initialized with an empty word list — the DFA filter
    // will never flag any content. Replace the placeholder array with a real
    // sensitive-word list loaded from environment config or a database table.
    this.sensitiveWordService.initialize([
      // Placeholder sensitive words — replace with real list
    ]);
  }

  async create(caseId: number, dto: CreateCommentDto): Promise<CommentWithReplies> {
    const storeId = StoreContext.getStoreId() as number;
    const staffId = StoreContext.getStaffId();

    if (!staffId) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '请先登录');
    }

    // Validate case exists
    const caseEntity = await this.caseRepo.findOne({
      where: { id: caseId, deleted_at: IsNull() },
    });
    if (!caseEntity) {
      throw new BusinessException(ErrorCode.CASE_NOT_FOUND, '案例不存在');
    }

    // Rate limit: 1 comment per 30s per user per case
    const recentComment = await this.commentRepo.findOne({
      where: {
        case_id: caseId,
        staff_id: staffId,
        created_at: MoreThan(new Date(Date.now() - 30000)),
        deleted_at: IsNull(),
      },
      order: { created_at: 'DESC' },
    });
    if (recentComment) {
      throw new BusinessException(ErrorCode.COMMENT_RATE_LIMITED, '评论过于频繁，请30秒后再试');
    }

    // Content sanitization
    const sanitizedContent = sanitizeText(dto.content);
    if (!sanitizedContent || sanitizedContent.length === 0) {
      throw new BusinessException(ErrorCode.VALIDATION_FAILED, '评论内容不能为空');
    }
    if (sanitizedContent.length > 500) {
      throw new BusinessException(ErrorCode.COMMENT_CONTENT_TOO_LONG, '评论内容不能超过500字');
    }

    // Validate parent comment exists (if replying)
    if (dto.parent_id) {
      const parentComment = await this.commentRepo.findOne({
        where: { id: dto.parent_id, case_id: caseId, deleted_at: IsNull() },
      });
      if (!parentComment) {
        throw new BusinessException(ErrorCode.COMMENT_NOT_FOUND, '被回复的评论不存在');
      }
      // Only allow 1 level of nesting (reply to top-level only)
      if (parentComment.parent_id !== null) {
        throw new BusinessException(ErrorCode.VALIDATION_FAILED, '评论最多支持二级嵌套');
      }
    }

    // DFA sensitive word check
    const status: 'approved' | 'pending' = this.sensitiveWordService.shouldPendingReview(sanitizedContent)
      ? 'pending'
      : 'approved';

    const comment = this.commentRepo.create({
      case_id: caseId,
      store_id: storeId,
      staff_id: staffId,
      parent_id: dto.parent_id ?? null,
      content: sanitizedContent,
      status,
    });

    const saved = await this.commentRepo.save(comment);

    // Increment comment count on case
    if (status === 'approved') {
      await this.caseRepo.increment({ id: caseId }, 'comment_count', 1);
    }

    return this.toCommentWithReplies(saved);
  }

  async findByCaseId(
    caseId: number,
    query: ListCommentDto,
  ): Promise<{
    items: CommentWithReplies[];
    total: number;
    page: number;
    size: number;
  }> {
    // Validate case exists
    const caseEntity = await this.caseRepo.findOne({
      where: { id: caseId, deleted_at: IsNull() },
    });
    if (!caseEntity) {
      throw new BusinessException(ErrorCode.CASE_NOT_FOUND, '案例不存在');
    }

    // Get top-level approved comments with staff relation
    const where: FindOptionsWhere<Comment> = {
      case_id: caseId,
      status: 'approved',
      parent_id: IsNull(),
      deleted_at: IsNull(),
    };

    const [comments, total] = await this.commentRepo.findAndCount({
      where,
      relations: ['staff'],
      order: { created_at: 'DESC' },
      skip: query.skip,
      take: query.take,
    });

    // Get replies for all top-level comments
    const commentIds = comments.map((c) => c.id);
    let repliesMap: Map<number, Comment[]> = new Map();

    if (commentIds.length > 0) {
      const replies = await this.commentRepo.find({
        where: {
          parent_id: In(commentIds),
          status: 'approved',
          deleted_at: IsNull(),
        } as FindOptionsWhere<Comment>,
        relations: ['staff'],
        order: { created_at: 'ASC' },
      });

      // Group replies by parent_id
      repliesMap = replies.reduce((map, reply) => {
        const parentId = reply.parent_id!;
        if (!map.has(parentId)) {
          map.set(parentId, []);
        }
        map.get(parentId)!.push(reply);
        return map;
      }, new Map<number, Comment[]>());
    }

    const items = comments.map((comment) => this.toCommentWithReplies(comment, repliesMap.get(comment.id) || []));

    return { items, total, page: query.page ?? 1, size: query.size ?? 20 };
  }

  async delete(caseId: number, commentId: number): Promise<void> {
    const staffId = StoreContext.getStaffId();
    const role = StoreContext.getRole();

    const comment = await this.commentRepo.findOne({
      where: { id: commentId, deleted_at: IsNull() },
    });
    if (!comment) {
      throw new BusinessException(ErrorCode.COMMENT_NOT_FOUND, '评论不存在');
    }

    // Cross-check that the comment belongs to the specified case
    if (comment.case_id !== caseId) {
      throw new BusinessException(ErrorCode.COMMENT_NOT_FOUND, '评论不属于指定案例');
    }

    // Only comment author or admin/manager can delete
    const isAuthor = comment.staff_id === staffId;
    const isAdmin = role === 'admin' || role === 'manager';
    if (!isAuthor && !isAdmin) {
      throw new BusinessException(ErrorCode.COMMENT_PERMISSION_DENIED, '无权删除此评论');
    }

    const now = new Date();
    await this.commentRepo.update(commentId, { deleted_at: now } as Partial<Comment>);

    // Decrement comment count if the comment was approved
    if (comment.status === 'approved') {
      await this.caseRepo.decrement({ id: comment.case_id }, 'comment_count', 1);
    }
  }

  async getPendingComments(
    page: number,
    size: number,
  ): Promise<{
    list: Comment[];
    total: number;
    page: number;
    size: number;
  }> {
    const skip = (page - 1) * size;
    const [list, total] = await this.commentRepo.findAndCount({
      where: { status: 'pending', deleted_at: IsNull() },
      relations: ['staff', 'case'],
      order: { created_at: 'ASC' },
      skip,
      take: size,
    });

    return { list, total, page, size };
  }

  async approve(commentId: number, dto: ApproveCommentDto): Promise<Comment> {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId, deleted_at: IsNull() },
    });
    if (!comment) {
      throw new BusinessException(ErrorCode.COMMENT_NOT_FOUND, '评论不存在');
    }

    if (comment.status !== 'pending') {
      throw new BusinessException(ErrorCode.VALIDATION_FAILED, '该评论不在待审核状态');
    }

    const newStatus = dto.action === 'approve' ? 'approved' : 'rejected';
    await this.commentRepo.update(commentId, { status: newStatus } as Partial<Comment>);

    // Increment comment count if approved
    if (newStatus === 'approved') {
      await this.caseRepo.increment({ id: comment.case_id }, 'comment_count', 1);
    }

    const updated = await this.commentRepo.findOne({
      where: { id: commentId },
      relations: ['staff', 'case'],
    });
    return updated!;
  }

  private toCommentWithReplies(comment: Comment, replies: Comment[] = []): CommentWithReplies {
    const currentStaffId = StoreContext.getStaffId() || 0;

    return {
      id: comment.id,
      content: comment.content,
      staff_name: comment.staff?.name ?? '未知用户',
      staff_avatar: comment.staff?.avatar ?? null,
      is_author: comment.staff_id === currentStaffId,
      created_at: comment.created_at,
      replies: replies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        staff_name: reply.staff?.name ?? '未知用户',
        staff_avatar: reply.staff?.avatar ?? null,
        is_author: reply.staff_id === currentStaffId,
        created_at: reply.created_at,
        replies: [],
      })),
    };
  }
}
