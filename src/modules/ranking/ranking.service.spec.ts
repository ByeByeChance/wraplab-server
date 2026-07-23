import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RankingService } from './ranking.service';
import { Case } from '../case/entities/case.entity';
import { QueryRankingDto } from './dto/query-ranking.dto';

describe('RankingService', () => {
  let service: RankingService;
  let caseRepo: jest.Mocked<Pick<Repository<Case>, 'findAndCount'>>;

  const mockCase: Partial<Case> = {
    id: 1,
    store_id: 1,
    configuration_id: 10,
    title: 'Top Case',
    status: 'published',
    view_count: 100,
    like_count: 50,
    share_count: 10,
    comment_count: 5,
    staff_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankingService,
        {
          provide: getRepositoryToken(Case),
          useValue: {
            findAndCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RankingService>(RankingService);
    caseRepo = module.get(getRepositoryToken(Case));
  });

  describe('getRanking', () => {
    it('should return ranked cases by like_count daily', async () => {
      caseRepo.findAndCount.mockResolvedValue([[mockCase as Case], 1]);

      const result = await service.getRanking(
        Object.assign(new QueryRankingDto(), {
          type: 'like_count',
          period: 'daily',
          limit: 20,
          page: 1,
          size: 20,
        }),
      );

      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.period).toBe('daily');
      expect(result.type).toBe('like_count');
      expect(caseRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { like_count: 'DESC' },
        }),
      );
    });

    it('should return ranked cases by view_count weekly', async () => {
      caseRepo.findAndCount.mockResolvedValue([[mockCase as Case], 1]);

      const result = await service.getRanking(
        Object.assign(new QueryRankingDto(), {
          type: 'view_count',
          period: 'weekly',
        }),
      );

      expect(result.type).toBe('view_count');
      expect(result.period).toBe('weekly');
      expect(caseRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { view_count: 'DESC' },
        }),
      );
    });

    it('should return ranked cases by comment_count monthly', async () => {
      caseRepo.findAndCount.mockResolvedValue([[mockCase as Case], 1]);

      const result = await service.getRanking(
        Object.assign(new QueryRankingDto(), {
          type: 'comment_count',
          period: 'monthly',
        }),
      );

      expect(result.type).toBe('comment_count');
      expect(result.period).toBe('monthly');
      expect(caseRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { comment_count: 'DESC' },
        }),
      );
    });

    it('should return empty list when no cases exist', async () => {
      caseRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getRanking(
        Object.assign(new QueryRankingDto(), {
          type: 'like_count',
          period: 'daily',
        }),
      );

      expect(result.list).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should respect pagination', async () => {
      caseRepo.findAndCount.mockResolvedValue([[mockCase as Case], 10]);

      const result = await service.getRanking(
        Object.assign(new QueryRankingDto(), {
          type: 'like_count',
          period: 'daily',
          page: 2,
          size: 5,
        }),
      );

      expect(result.page).toBe(2);
      expect(result.size).toBe(5);
      expect(caseRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        }),
      );
    });
  });
});
