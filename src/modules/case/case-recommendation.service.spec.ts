import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CaseRecommendationService } from './case-recommendation.service';
import { Case } from './entities/case.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';

describe('CaseRecommendationService', () => {
  let service: CaseRecommendationService;
  let caseRepo: jest.Mocked<Pick<Repository<Case>, 'findOne' | 'find'>>;

  const mockCase: Partial<Case> = {
    id: 1,
    store_id: 1,
    configuration_id: 1,
    title: 'Cool Wrap Case',
    description: 'A nice wrap',
    cover_image_url: 'https://img.example.com/1.jpg',
    images: null,
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseRecommendationService,
        {
          provide: getRepositoryToken(Case),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CaseRecommendationService>(CaseRecommendationService);
    caseRepo = module.get(getRepositoryToken(Case));
  });

  describe('recommend', () => {
    it('should return recommended cases from multiple layers', async () => {
      const otherCase = { ...mockCase, id: 2, title: 'Another Case', store_id: 1, like_count: 30 };
      const popularCase = { ...mockCase, id: 3, title: 'Popular Case', store_id: 2, like_count: 80 };
      const hotCase = { ...mockCase, id: 4, title: 'Hot Case', store_id: 3, like_count: 100 };

      (caseRepo.findOne as jest.Mock).mockResolvedValue(mockCase as Case);
      (caseRepo.find as jest.Mock)
        .mockResolvedValueOnce([otherCase] as Case[]) // sameStoreCases
        .mockResolvedValueOnce([popularCase] as Case[]) // sameColorCases
        .mockResolvedValueOnce([hotCase] as Case[]); // hotCases

      const result = await service.recommend(1);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(caseRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 1 }) }),
      );
    });

    it('should boost same-store cases when storeId provided', async () => {
      const sameStoreCase = { ...mockCase, id: 2, title: 'Same Store', store_id: 1, like_count: 10 };
      const otherStoreCase = { ...mockCase, id: 3, title: 'Other Store', store_id: 2, like_count: 90 };

      (caseRepo.findOne as jest.Mock).mockResolvedValue(mockCase as Case);
      (caseRepo.find as jest.Mock)
        .mockResolvedValueOnce([sameStoreCase] as Case[]) // sameStoreCases
        .mockResolvedValueOnce([otherStoreCase] as Case[]) // sameColorCases
        .mockResolvedValueOnce([] as Case[]); // hotCases

      const result = await service.recommend(1, 6, 1);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(2);
      // Same-store cases should come first with '同门店案例' match reason
      expect(result[0].match_reason).toBe('同门店案例');
    });

    it('should throw when source case not found', async () => {
      (caseRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.recommend(999)).rejects.toThrow(BusinessException);
    });

    it('should handle recommendation engine error gracefully', async () => {
      (caseRepo.findOne as jest.Mock).mockResolvedValue(mockCase as Case);
      (caseRepo.find as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(service.recommend(1)).rejects.toThrow(BusinessException);
    });

    it('should return empty when no other cases exist', async () => {
      (caseRepo.findOne as jest.Mock).mockResolvedValue(mockCase as Case);
      (caseRepo.find as jest.Mock)
        .mockResolvedValueOnce([] as Case[]) // sameStoreCases
        .mockResolvedValueOnce([] as Case[]) // sameColorCases
        .mockResolvedValueOnce([] as Case[]); // hotCases

      const result = await service.recommend(1);

      expect(result).toHaveLength(0);
    });
  });
});
