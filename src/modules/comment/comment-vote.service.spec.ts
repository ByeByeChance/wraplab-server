import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository, UpdateResult, DeleteResult } from 'typeorm';
import { CommentVoteService } from './comment-vote.service';
import { CommentVote } from './entities/comment-vote.entity';
import { Comment } from './entities/comment.entity';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('CommentVoteService', () => {
  let service: CommentVoteService;
  let voteRepo: jest.Mocked<Repository<CommentVote>>;
  let commentRepo: jest.Mocked<Repository<Comment>>;

  const mockComment: Partial<Comment> = {
    id: 1,
    case_id: 1,
    store_id: 1,
    staff_id: 1,
    parent_id: null,
    content: 'Test comment',
    status: 'approved' as const,
    vote_count: 5,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentVoteService,
        {
          provide: getRepositoryToken(CommentVote),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Comment),
          useValue: {
            findOne: jest.fn(),
            increment: jest.fn(),
            decrement: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CommentVoteService>(CommentVoteService);
    voteRepo = module.get(getRepositoryToken(CommentVote));
    commentRepo = module.get(getRepositoryToken(Comment));
  });

  describe('toggle', () => {
    it('should add a vote (like)', async () => {
      commentRepo.findOne.mockResolvedValue(mockComment as unknown as Comment);
      voteRepo.findOne.mockResolvedValue(null);
      voteRepo.create.mockReturnValue({} as unknown as CommentVote);
      voteRepo.save.mockResolvedValue({} as unknown as CommentVote);
      commentRepo.increment.mockResolvedValue({} as unknown as UpdateResult);
      // Re-read after increment
      commentRepo.findOne.mockResolvedValue({ vote_count: 6 } as unknown as Comment);

      const result = await service.toggle(1, 1, 1);

      expect(result.is_voted).toBe(true);
      expect(result.vote_count).toBe(6);
    });

    it('should remove a vote (unlike)', async () => {
      commentRepo.findOne.mockResolvedValue(mockComment as unknown as Comment);
      voteRepo.findOne.mockResolvedValue({ id: BigInt(1) } as unknown as CommentVote);
      voteRepo.delete.mockResolvedValue({} as unknown as DeleteResult);
      commentRepo.decrement.mockResolvedValue({} as unknown as UpdateResult);
      // Re-read after decrement
      commentRepo.findOne.mockResolvedValue({ vote_count: 4 } as unknown as Comment);

      const result = await service.toggle(1, 1, 1);

      expect(result.is_voted).toBe(false);
      expect(result.vote_count).toBe(4);
    });

    it('should throw when comment not found', async () => {
      commentRepo.findOne.mockResolvedValue(null);

      await expect(service.toggle(999, 1, 1)).rejects.toThrow(BusinessException);
    });
  });
});
