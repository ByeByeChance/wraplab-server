import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentService } from './comment.service';
import { Comment } from './entities/comment.entity';
import { Case } from '../case/entities/case.entity';
import { SensitiveWordService } from './sensitive-word.service';
import { ListCommentDto } from './dto/list-comment.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { StoreContext } from '../../common/context/store-context';

jest.mock('../../common/context/store-context');

describe('CommentService', () => {
  let service: CommentService;
  let commentRepo: jest.Mocked<
    Pick<Repository<Comment>, 'findOne' | 'findAndCount' | 'find' | 'create' | 'save' | 'update'>
  >;
  let caseRepo: jest.Mocked<Pick<Repository<Case>, 'findOne' | 'increment' | 'decrement'>>;
  let sensitiveWordService: jest.Mocked<SensitiveWordService>;

  const mockCase: Partial<Case> = {
    id: 1,
    store_id: 1,
    configuration_id: 10,
    title: 'Test Case',
    status: 'published',
    view_count: 0,
    like_count: 0,
    share_count: 0,
    comment_count: 0,
    staff_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockStaff = {
    id: 1,
    name: 'Test Staff',
    avatar: null,
  };

  const mockComment: Partial<Comment> = {
    id: 1,
    case_id: 1,
    store_id: 1,
    staff_id: 1,
    parent_id: null,
    content: 'Great case!',
    status: 'approved',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    staff: mockStaff as Comment['staff'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);
    (StoreContext.getStaffId as jest.Mock).mockReturnValue(1);
    (StoreContext.isAdmin as jest.Mock).mockReturnValue(false);
    (StoreContext.getRole as jest.Mock).mockReturnValue('staff');

    const mockSensitiveWordService = {
      initialize: jest.fn(),
      containsSensitiveWord: jest.fn().mockReturnValue(null),
      shouldPendingReview: jest.fn().mockReturnValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        {
          provide: getRepositoryToken(Comment),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Case),
          useValue: {
            findOne: jest.fn(),
            increment: jest.fn(),
            decrement: jest.fn(),
          },
        },
        {
          provide: SensitiveWordService,
          useValue: mockSensitiveWordService,
        },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    commentRepo = module.get(getRepositoryToken(Comment));
    caseRepo = module.get(getRepositoryToken(Case));
    sensitiveWordService = module.get(SensitiveWordService);
  });

  describe('create', () => {
    it('should create an approved comment', async () => {
      caseRepo.findOne.mockResolvedValue(mockCase as Case);
      commentRepo.findOne.mockResolvedValue(null); // no recent comment (rate limit check)
      commentRepo.create.mockReturnValue(mockComment as Comment);
      commentRepo.save.mockResolvedValue(mockComment as Comment);
      caseRepo.increment.mockResolvedValue({} as unknown as ReturnType<Repository<Case>['increment']>);

      const result = await service.create(1, { content: 'Great case!' });

      expect(result).toBeDefined();
      expect(result.content).toBe('Great case!');
      expect(caseRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'comment_count', 1);
    });

    it('should set pending status when sensitive words detected', async () => {
      caseRepo.findOne.mockResolvedValue(mockCase as Case);
      commentRepo.findOne.mockResolvedValue(null);
      sensitiveWordService.shouldPendingReview.mockReturnValue(true);
      const pendingComment = { ...mockComment, status: 'pending' as const };
      commentRepo.create.mockReturnValue(pendingComment as Comment);
      commentRepo.save.mockResolvedValue(pendingComment as Comment);

      const result = await service.create(1, { content: 'bad word' });

      expect(result).toBeDefined();
      expect(sensitiveWordService.shouldPendingReview).toHaveBeenCalled();
      expect(caseRepo.increment).not.toHaveBeenCalled();
    });

    it('should throw when case does not exist', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(service.create(999, { content: 'Test' })).rejects.toThrow(BusinessException);
    });

    it('should throw when rate limited (comment within 30s)', async () => {
      caseRepo.findOne.mockResolvedValue(mockCase as Case);
      commentRepo.findOne.mockResolvedValue(mockComment as Comment); // recent comment exists

      await expect(service.create(1, { content: 'Test' })).rejects.toThrow(BusinessException);
    });

    it('should throw when parent comment does not exist', async () => {
      caseRepo.findOne.mockResolvedValue(mockCase as Case);
      commentRepo.findOne
        .mockResolvedValueOnce(null) // rate limit check: no recent comment
        .mockResolvedValueOnce(null); // parent not found

      await expect(service.create(1, { content: 'Reply', parent_id: 999 })).rejects.toThrow(BusinessException);
    });

    it('should throw when replying to a reply (level 2)', async () => {
      caseRepo.findOne.mockResolvedValue(mockCase as Case);
      const parentReply: Partial<Comment> = {
        ...mockComment,
        id: 1,
        parent_id: 5, // this is a reply, not top-level
      };
      commentRepo.findOne
        .mockResolvedValueOnce(null) // rate limit check: no recent comment
        .mockResolvedValueOnce(parentReply as Comment); // parent exists but is a reply

      await expect(service.create(1, { content: 'Reply to reply', parent_id: 1 })).rejects.toThrow(BusinessException);
    });
  });

  describe('findByCaseId', () => {
    it('should return paginated comments with replies', async () => {
      caseRepo.findOne.mockResolvedValue(mockCase as Case);
      commentRepo.findAndCount.mockResolvedValue([[mockComment as Comment], 1]);
      commentRepo.find.mockResolvedValue([]); // no replies

      const result = await service.findByCaseId(1, Object.assign(new ListCommentDto(), { page: 1, size: 20 }));

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.size).toBe(20);
    });

    it('should throw when case not found', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByCaseId(999, Object.assign(new ListCommentDto(), { page: 1, size: 20 })),
      ).rejects.toThrow(BusinessException);
    });

    it('should return empty list when no comments exist', async () => {
      caseRepo.findOne.mockResolvedValue(mockCase as Case);
      commentRepo.findAndCount.mockResolvedValue([[], 0]);
      commentRepo.find.mockResolvedValue([]);

      const result = await service.findByCaseId(1, Object.assign(new ListCommentDto(), { page: 1, size: 20 }));

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('delete', () => {
    it('should soft delete own comment', async () => {
      commentRepo.findOne.mockResolvedValue(mockComment as Comment);
      commentRepo.update.mockResolvedValue({ affected: 1 } as unknown as ReturnType<Repository<Comment>['update']>);
      caseRepo.decrement.mockResolvedValue({} as unknown as ReturnType<Repository<Case>['decrement']>);

      await service.delete(1, 1);

      expect(commentRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ deleted_at: expect.any(Date) }));
      expect(caseRepo.decrement).toHaveBeenCalledWith({ id: 1 }, 'comment_count', 1);
    });

    it('should allow admin to delete any comment', async () => {
      (StoreContext.getStaffId as jest.Mock).mockReturnValue(2); // different staff
      (StoreContext.getRole as jest.Mock).mockReturnValue('admin');

      commentRepo.findOne.mockResolvedValue(mockComment as Comment);
      commentRepo.update.mockResolvedValue({ affected: 1 } as unknown as ReturnType<Repository<Comment>['update']>);
      caseRepo.decrement.mockResolvedValue({} as unknown as ReturnType<Repository<Case>['decrement']>);

      await service.delete(1, 1);

      expect(commentRepo.update).toHaveBeenCalled();
    });

    it('should throw when comment not found', async () => {
      commentRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999, 999)).rejects.toThrow(BusinessException);
    });

    it('should throw when not author and not admin', async () => {
      (StoreContext.getStaffId as jest.Mock).mockReturnValue(2); // different staff
      (StoreContext.getRole as jest.Mock).mockReturnValue('staff');

      commentRepo.findOne.mockResolvedValue(mockComment as Comment);

      await expect(service.delete(1, 1)).rejects.toThrow(BusinessException);
    });

    it('should throw when caseId does not match comment case_id', async () => {
      commentRepo.findOne.mockResolvedValue(mockComment as Comment); // case_id = 1

      await expect(service.delete(999, 1)).rejects.toThrow(BusinessException);
    });
  });

  describe('getPendingComments', () => {
    it('should return pending comments', async () => {
      const pendingComment = { ...mockComment, status: 'pending' as const };
      commentRepo.findAndCount.mockResolvedValue([[pendingComment as Comment], 1]);

      const result = await service.getPendingComments(1, 20);

      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should return empty list when no pending comments', async () => {
      commentRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getPendingComments(1, 20);

      expect(result.list).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('approve', () => {
    it('should approve a pending comment', async () => {
      const pendingComment = { ...mockComment, status: 'pending' as const };
      const approvedComment = { ...mockComment, status: 'approved' as const };

      commentRepo.findOne.mockResolvedValueOnce(pendingComment as Comment);
      commentRepo.update.mockResolvedValue({ affected: 1 } as unknown as ReturnType<Repository<Comment>['update']>);
      caseRepo.increment.mockResolvedValue({} as unknown as ReturnType<Repository<Case>['increment']>);
      commentRepo.findOne.mockResolvedValueOnce(approvedComment as Comment);

      const result = await service.approve(1, { action: 'approve' });

      expect(result.status).toBe('approved');
      expect(caseRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'comment_count', 1);
    });

    it('should reject a pending comment', async () => {
      const pendingComment = { ...mockComment, status: 'pending' as const };
      const rejectedComment = { ...mockComment, status: 'rejected' as const };

      commentRepo.findOne.mockResolvedValueOnce(pendingComment as Comment);
      commentRepo.update.mockResolvedValue({ affected: 1 } as unknown as ReturnType<Repository<Comment>['update']>);
      commentRepo.findOne.mockResolvedValueOnce(rejectedComment as Comment);

      const result = await service.approve(1, { action: 'reject' });

      expect(result.status).toBe('rejected');
      expect(caseRepo.increment).not.toHaveBeenCalled();
    });

    it('should throw when comment not found', async () => {
      commentRepo.findOne.mockResolvedValue(null);

      await expect(service.approve(999, { action: 'approve' })).rejects.toThrow(BusinessException);
    });

    it('should throw when comment is not pending', async () => {
      commentRepo.findOne.mockResolvedValue(mockComment as Comment); // already approved

      await expect(service.approve(1, { action: 'approve' })).rejects.toThrow(BusinessException);
    });
  });
});
